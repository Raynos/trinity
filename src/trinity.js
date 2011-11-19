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
	Constucts a trinity object
*/
var Trinity = {
	/*
		adds the css text to the cssNode

		@param String uri - file to load
		@param Function cb<Error, CSSText> - callback to fire when finished
	*/
	createCSS: function _createCSS(uri, cb) {
		var that = this;

		function readFile(error, file) {
			if (error) return cb(error);

			that.cssNode.textContent += file;
			cb(null, file);
		}
		
		fs.readFile(config.path + uri + ".css", readFile);	
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
			adoptNode(fragment, that.doc);

			that.frag = fragment;

			cb(null, fragment);
		}
	
		fs.readFile(config.path + uri + ".html", readFile);
	},
	/*
		loads the javascript file at the uri

		@param String uri - file to load
		@param Function cb<Error, Function> - callback to fire when loaded. 
			get's passed the function f created	from the files source code
	*/
	createJavaScript: function _loadJavaScript(uri, cb) {
		var that = this;

		function readFile(err, file) {
			if (err) return cb(err);

			var f = Function("frag", "data", "load", file);
			that.func = f;

			cb(null, f);
		}

		fs.readFile(config.path + uri + ".js", readFile);
	},
	/*
		Make a new Trinity

		@param Loader loader - the loader attached to the trinity object
		@param Document doc - the document that the trinity belongs to
		@param Node cssNode - a Style node to append CSS strings to

		@return Trinity
	*/
	make: function _make(doc, cssNode) {
		var t = Object.create(Trinity);
		t.doc = doc;
		t.cssNode = cssNode;
		return t;
	}
};

/*
	Load a trinity

	@param Document doc - doc to bind the trinity to
	@param Node cssNode - css node to add css text to
	@param String uri - trinity to load
	@param Object json - json data to pass to the JS file
	@param Function cb<Error, DocumentFragment, Function> -
		callback to invoke when ready, passes the document fragment
		and another load function to invoke
	@param optional Function out - an out function to call
		in recursive calls to load. This allows you to finish outer
		load calls only when inner load calls finish.
*/
function load(doc, cssNode, uri, json, cb, out) {
	var that = this,
		trinity = Trinity.make(doc, cssNode),
		_load = load.bind(null, doc, cssNode),
		count = 3;

	/*
		When all javascript, documentfragment and css have been created
		The next block gets invoked

		Here we simply invoke the function and call finish.

		We use a load proxy to ensure that this "load" only finishes after the 
		load we proxy finishes.
	*/
	function next() {
		--count;
		if (count === 0) {

			var func = trinity.func,
				frag = trinity.frag;

			func && func(frag, json, function _loadProxy(uri, json, cb) {
				count++;
				_load(uri, json, function _callbackProxy() {
					cb.apply(this, arguments);
					finish();
				});
			});

			count++;
			finish();
		}
	}

	/*
		Loading has finished, return the fragment
	*/
	function finish() {
		--count;
		if (count === 0) {
			cb(null, trinity.frag, _load);	
		}	
	}

	function errorHandler(err, func) {
		err ? cb(err) : next();
	}

	function swallowFileDoesNotExist(err, func) {
		if (err && err.message.indexOf("No such file") === -1) {
			return cb(err);
		}
		next();
	}

	trinity.createJavaScript(uri, swallowFileDoesNotExist)
	
	trinity.createDocumentFragment(uri, errorHandler);

	trinity.createCSS(uri, swallowFileDoesNotExist);
}

	
/*
	Wraps a Trinity object in statics
*/
var Statics = {
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

			load(that.doc, that.cssNode, uri, json, cb);
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

	Statics.load(module, json, cb);
};

trinity.Statics = Statics;
trinity.Trinity = Trinity;
trinity.load = load;

/*
	set config values

	@param String name - name to set
	@param Any val - value to set
*/
trinity.set = function _set(name, val) {
	config[name] = val;
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