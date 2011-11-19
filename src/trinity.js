var jsdom = require("jsdom"),
	http = require("http"),
	path = require("path"),
	burrito = require("burrito")
	fs = require("fs");

var config = {
	"static": "static",
	"publicPath": "trinity"
};

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

var cachedRead = (function () {
	var cache = {};

	function readFile(name, cb) {
		var file = cache[name];
		if (file) {
			return cb(null, file);
		}

		fs.readFile(name, function (err, file) {
			if (file) cache[name] = file;
			cb.apply(this, arguments);
		});
	}

	return readFile;
})();

/*
	Constucts a trinity object
*/
var Trinity = {
	/*
		calls create on CSS, JS and HTML.

		@param String uri - trinity to load
		@param Function cb<Error> - callback to fire when finished
		@param optional Boolean sync - sync flag as to whether 
			the operation should be	synchronous
	*/
	create: function _create(uri, cb, sync) {
		var count = 3;

		function next() {
			count--;
			count === 0 && cb(null);
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

		this.createJavaScript(uri, swallowFileDoesNotExist, sync)
		
		this.createDocumentFragment(uri, errorHandler, sync);

		this.createCSS(uri, swallowFileDoesNotExist, sync);
	},
	/*
		adds the css text to the cssNode

		@param String uri - file to load
		@param Function cb<Error, CSSText> - callback to fire when finished
		@param optional Boolean sync - sync flag as to whether 
			the operation should be	synchronous
	*/
	createCSS: function _createCSS(uri, cb, sync) {
		var that = this,
			url = path.join(config.path,uri) + ".css";

		function readFile(error, file) {
			if (error) return cb(error);

			that.cssNode.textContent += file;
			cb(null, file);
		}

		this.readFile(url, readFile, sync);
	},
	/*
		creates a document fragment from the html at the ui

		@param String uri - file to load
		@param Function cb<Error, DocumentFragment> - callback to fire 
			when loaded. Get's passed the document fragment build from the HTML
		@param optional Boolean sync - sync flag as to whether 
			the operation should be	synchronous
	*/
	createDocumentFragment: function _createDocumentFragment(uri, cb, sync) {
		var that = this,
			url = path.join(config.path, uri) + ".html";

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

		this.readFile(url, readFile, sync);
	},
	/*
		loads the javascript file at the uri

		@param String uri - file to load
		@param Function cb<Error, Function> - callback to fire when loaded. 
			get's passed the function f created	from the files source code
		@param optional Boolean sync - sync flag as to whether 
			the operation should be	synchronous
	*/
	createJavaScript: function _loadJavaScript(uri, cb, sync) {
		var that = this,
			url = path.join(config.path, uri) + ".js";
		
		function readFile(err, file) {
			if (err) return cb(err);

			that.preload(file, function _finish() {
				var f = Function("frag", "data", "load", file);
				that.func = f;

				cb(null, f);
			});			
		}

		this.readFile(url, readFile, sync);
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
	},
	/*
		preload a trinity

		@param String file - file to read. Any load("module") calls should
			be extracted and the trinity "module" should be preloaded.
			Works recursively
		@param Function cb - callback to invoke when done
	*/
	preload: function _preload(file, cb) {
		var that = this,
			modules = [];

		burrito(file, function (node) {
			if (node.name === "call" &&
				node.label() === "load"
			) {
				var module = node.value[1][0][1];
				modules.push(module);
			}
		});

		var count = modules.length * 3 + 1;

		function next() {
			count--;
			count === 0 && cb();
		}

		function recurseForJavaScript(err, file) {
			if (file) {
				that.preload(file, next);
			} else {
				next();
			}
		}

		modules.forEach(function (module) {
			var url = path.join(config.path, module);
			cachedRead(url + ".js", recurseForJavaScript);
			cachedRead(url + ".css", next);
			cachedRead(url + ".html", next);
		});

		next();
	},
	/*
		readFile Utility

		@param String url - url to read
		@param Function cb<Error, File> - callback to fire on reading
		@param Boolean sync - whether to use sync method
	*/
	readFile: function _readFile(url, cb, sync) {
		if (!sync) {
			cachedRead(url, cb);
		} else {
			var file, err = null;
			try {
				file = fs.readFileSync(url);
			} catch (e) {
				err = e;
			}
			cb(err, file);
		}
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
	@param optional Boolean sync - sync flag as to whether 
			the operation should be	synchronous
*/
function load(doc, cssNode, uri, json, cb, sync) {
	var that = this,
		trinity = Trinity.make(doc, cssNode),
		_load = load.bind(null, doc, cssNode),
		count = 0;

	/*
		When all javascript, documentfragment and css have been created
		The next block gets invoked

		Here we simply invoke the function and call finish.

		We use a load proxy to ensure that this "load" only finishes after the 
		load we proxy finishes.
	*/
	function next(err) {
		if (err) return cb(err);

		var func = trinity.func,
			frag = trinity.frag;

		func && func(frag, json, function _loadProxy(uri, json) {
			var ret;
			console.log("start");
			_load(uri, json, function (err, frag) {
				console.log("middle");
				ret = frag;
			}, true);
			console.log("end");
			return ret;
		});

		cb(null, trinity.frag, _load);	
	}

	trinity.create(uri, next, sync);
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
		this.doc.body.appendChild(script);	
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

	Object.create(Statics).load(module, json, cb);
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