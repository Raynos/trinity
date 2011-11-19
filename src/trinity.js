var jsdom = require("jsdom"),
	http = require("http"),
	vm = require("vm"),
	fs = require("fs");

var config = {
	"static": "static",
	"publicPath": "trinity"
};

var bodyRegExp = /\{(.+?)\}+$/;

/*
	adoptNode implements the DOM4 node adoption algorithm.

	@param Node node - the node to adopt
	@param Document doc - the document to adopt it into
*/
var adoptNode = (function () {
	function setOwnerDocument(node, doc) {
		node._ownerDocument = doc;
		node._attributes._ownerDocument = doc;
		[].forEach.call(node.childNodes, function (node) {
			setOwnerDocument(node, doc);
		});
	}

	function adoptNode(node, doc) {
		node.parentNode = null;
		setOwnerDocument(node, doc);
	}

	return adoptNode;
}());

/*
	Loader is a small wrapper around loading a single trinity.
*/
var Loader = {
	/*
		loads the javascript file at the uri

		@param String uri - file to load
		@param Function cb<Error, Function> - callback to fire when loaded. 
			get's passed the function f created	from the files source code
	*/
	loadJavaScript: function _loadJavaScript(uri, cb) {
		var path = config.path + uri + ".js";

		function readFile(err, file) {
			if (err) return cb(err);
			var f = Function("frag", "data", "load", file);
			cb(null, f);
		}

		fs.readFile(path, readFile);
	},
	/*
		creates a document fragment from the html at the ui

		@param String uri - file to load
		@param Function cb<Error, DocumentFragment> - callback to fire 
			when loaded. Get's passed the document fragment build from the HTML
	*/
	createDocumentFragment: function _createDocumentFragment(uri, cb) {
		var that = this;

		function readFile(error, file) {
			if (error) return cb(error);
			var doc = jsdom.jsdom(file);
			if (!that.doc) that.doc = doc;
			var fragment = doc.createDocumentFragment();
			[].forEach.call(doc.childNodes, function (node) {
				fragment.appendChild(node);
			});
			cb(null, fragment);
		}
	
		fs.readFile(config.path + uri + ".html", readFile);
	},
	/*
		Make a new loader

		@param Document doc - the html document the dom fragment that is loaded
			should belong to
		@param Node cssNode - a Style node to append CSS strings to
	*/
	make: function _make(doc, cssNode) {
		var l = Object.create(Loader);
		l.doc = doc;
		l.cssNode = cssNode;
		return l;
	},
	/*
		Load a trinity

		@param String uri - trinity to load
		@param Object json - json data to pass to the JS file
		@param Function cb<Error, DocumentFragment, Function> -
			callback to invoke when ready, passes the document fragment
			and another load function to invoke
		@param optional Function out - an out function to call
			in recursive calls to load. This allows you to finish outer
			load calls only when inner load calls finish.
	*/
	load: function _load(uri, json, cb, out) {
		var that = this,
			loader = Loader.make(this.doc, this.cssNode),
			_load = loader.load.bind(loader),
			count = 2;

		function next() {
			--count;
			if (count === 0) {
				cb(null, that.frag, _load);
				out && out();
			}
		}

		function handleFrag(error, obj) {
			that.frag = obj;
			if (error) {
				return cb(error);
			}
			adoptNode(obj, that.doc);
			that.loadJavaScript(uri, function (err, func) {
				if (err && err.message.indexOf("No such file") === -1) {
					return cb(err);
				}
				if (func) {
					var loadCalled = false;
					func(that.frag, json, function (uri, data, cb) {
						loadCalled = true;
						loader.load(uri, data, cb, next);
					});	
					if (!loadCalled) {
						next();
					}
				} else {
					next();
				}
			});
		}

		function readCSS(err, css) {
			if (err && err.message.indexOf("No such file") === -1) {
				return cb(error);
			}
			if (css && that.cssNode) {
				that.cssNode.textContent += css;	
			}
			next();
		}
		
		// load html into fragment
		this.createDocumentFragment(uri, handleFrag);

		fs.readFile(config.path + uri + ".css", readCSS);
	}
};
	
/*
	Trinity object, thin wrapper around a loader but also builds
	a static Document.
*/
var Trinity = {
	/*
		adds a static CSS node
	*/
	addStaticCSS: function _addStaticCSS() {
		var link = this.doc.createElement("link");
		link.rel = "stylesheet";
		link.href = config.publicPath + "/" + config.static + ".css";
		this.doc.head.appendChild(link);
	}, 
	/*
		adds a static JS node
	*/
	addStaticJS: function _addStaticJS() {
		var script = this.doc.createElement("script");
		script.type = "text/javascript";
		script.src = config.publicPath + "/" + config.static + ".js";
		this.doc.head.appendChild(script);	
	},
	/*
		adds an empty CSS node to dump CSS into
	*/
	addEmptyCSSNode: function _addEmptyCSSNode() {
		var style = this.doc.createElement("style");
		style.type = "text/css";
		style.id = "trinity-css-container";
		this.cssNode = style;
		this.doc.head.appendChild(style);
	},
	/*
		Constructs all the statics and then creates a new Loader and invokes
		load on it.

		@param String uri - uri of trinity to load
		@param Object json - json data to pass to JS file of the trinity
		@param Function cb<Error, DocumentFragment, Load> - callback is 
			to be invoked when the document has loaded. Returns the
			document fragment from the Loader.load call and also returns
			another load function
	*/
	load: function (uri, json, cb) {
		var that = this;

		function handlEnv(err, window) {

			if (err && err.length) return cb(err);

			that.doc = window.document;

			that.addStaticCSS();
			
			that.addStaticJS();

			that.addEmptyCSSNode();

			Loader.make(that.doc, that.cssNode).load(uri, json, cb);
		}

		// load static.html
		jsdom.env(config.path + config.static + ".html", handlEnv);
	}
};

/*
	trinity loads a trinity

	@param String uri - uri of trinity to load
	@param Object json - json data to pass to JS file of the trinity
	@param Function cb<Error, DocumentFragment, Load> - callback is 
		to be invoked when the document has loaded. Returns the
		document fragment from the Loader.load call and also returns
		another load function
*/
function trinity(module, json, cb) {
	var doc; 

	if (typeof json === "function") {
		cb = json;
		json = null;
	}

	Trinity.load(module, json, cb);
};

trinity.Trinity = Trinity;
trinity.Loader = Loader;

/*
	set config values

	@param String name - name to set
	@param Any val - value to set
*/
trinity.set = function _set(name, val) {
	config[name] = val;
};

/*
	Invoke load directly on a new loader object.

	Bunch of weird edge cases

	@param String uri - uri of trinity to load
	@param Object json - json data to pass to JS file of the trinity
	@param Function cb<Error, DocumentFragment, Load> - callback is 
		to be invoked when the document has loaded. Returns the
		document fragment from the Loader.load call and also returns
		another load function
*/
trinity.load = function _load(uri, json, cb) {
	Loader.make().load(uri, json, cb);
};

trinity.punchExpress = function _punchExpress() {
	http.ServerResponse.prototype.render = function _render(uri, json) {
		var that = this;
		trinity(uri, json, function (error, frag) {
			var doc = frag.ownerDocument;
			doc.body.appendChild(frag);
			that.send(doc.innerHTML);
		});
	};
}


module.exports = trinity;