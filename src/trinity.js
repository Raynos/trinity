var jsdom = require("jsdom"),
	http = require("http"),
	path = require("path"),
	burrito = require("burrito")
	fs = require("fs");

var config = {
	"static": "static",
	"publicPath": "/trinity"
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
		[].slice.call(node.childNodes).forEach(function (node) {
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
	cachedRead, like fs.readFile but cached

	@param String name - file uri to read
	@param Function cb<Error, File> - callback to invoke with file
*/
var cachedRead = (function () {
	var cache = {};

	function readFile(name, cb) {
		var obj = cache[name];
		if (!obj) {
			cache[name] = {};
		} else if (obj.file) {
			return cb(null, obj.file);
		} else if (obj.err) {
			return cb(obj.err);
		}

		fs.readFile(name, function (err, file) {
			if (file) cache[name].file = file;
			if (err) cache[name].err = err;
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
	*/
	create: function _create(uri, cb) {
		var count = 3;

		function next() {
			count--;
			count === 0 && cb(null);
		}

		function errorHandler(err, func) {
			err ? cb(err) : next();
		}

		function swallowFileDoesNotExist(err, func) {
			if (err && err.message.indexOf("no such file") === -1) {
				return cb(err);
			}
			next();
		}

		this.createJavaScript(uri, swallowFileDoesNotExist)
		
		this.createDocumentFragment(uri, errorHandler);

		this.createCSS(uri, swallowFileDoesNotExist);
	},
	/*
		adds the css text to the cssNode

		@param String uri - file to load
		@param Function cb<Error, CSSText> - callback to fire when finished
	*/
	createCSS: function _createCSS(uri, cb) {
		var that = this,
			url = path.join(config.path, "css", uri) + ".css";

		function readFile(error, file) {
			if (error) return cb(error);

			that.cssNode.textContent += file;
			cb(null, file);
		}

		this.readFile(url, readFile);
	},
	/*
		creates a document fragment from the html at the ui

		@param String uri - file to load
		@param Function cb<Error, DocumentFragment> - callback to fire 
			when loaded. Get's passed the document fragment build from the HTML
	*/
	createDocumentFragment: function _createDocumentFragment(uri, cb) {
		var that = this,
			url = path.join(config.path, "html", uri) + ".html";

		function readFile(error, file) {
			if (error) return cb(error);

			var doc = jsdom.jsdom(file);
			if (!that.doc) that.doc = doc;

			var fragment = doc.createDocumentFragment();
			[].slice.call(doc.childNodes).forEach(function (node) {
				fragment.appendChild(node);
			});
			adoptNode(fragment, that.doc);

			that.frag = fragment;
			
			cb(null, fragment);
		}

		this.readFile(url, readFile);
	},
	/*
		loads the javascript file at the uri

		@param String uri - file to load
		@param Function cb<Error, Function> - callback to fire when loaded. 
			get's passed the function f created	from the files source code
	*/
	createJavaScript: function _loadJavaScript(uri, cb) {
		var that = this,
			url = path.join(config.path, "js", uri) + ".js";
		
		function readFile(err, file) {
			if (err) return cb(err);

			that.preload(file, function _finish() {
				var f = Function("frag", "data", "load", file);
				that.func = f;

				cb(null, f);
			});			
		}

		this.readFile(url, readFile);
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

		function next(err) {
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
			var jsurl = path.join(config.path, "js", module);
			var cssurl = path.join(config.path, "css", module);
			var htmlurl = path.join(config.path, "html", module);
			cachedRead(jsurl + ".js", recurseForJavaScript);
			cachedRead(cssurl + ".css", next);
			cachedRead(htmlurl + ".html", next);
		});

		next();
	},
	/*
		readFile Utility

		@param String url - url to read
		@param Function cb<Error, File> - callback to fire on reading
	*/
	readFile: function _readFile(url, cb) {
		cachedRead(url, cb);
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
*/
function load(doc, cssNode, uri, json, cb) {
	var that = this,
		trinity = Trinity.make(doc, cssNode),
		_load = load.bind(null, doc, cssNode),
		count = 0;

	/*
		When all javascript, documentfragment and css have been created
		The next block gets invoked

		Here we simply invoke the function and call finish.

		We use a load proxy to ensure that the passed load function does
		blocking loads
	*/
	function next(err) {
		if (err) return cb(err);

		var func = trinity.func,
			frag = trinity.frag;

		// intercept load, make a blocking load and return the domfrag
		func && func(frag, json, function _loadProxy(uri, json) {
			var ret;
			_load(uri, json, function _callbackProxy(err, frag) {
				ret = frag;
			});
			return ret;
		});

		cb(null, trinity.frag, _load);	
	}

	trinity.create(uri, next);
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
		link.href = path.join(config.publicPath, "css", config.static) + ".css";
		this.doc.head.appendChild(link);
	}, 
	/*
		adds a static JS node
	*/
	addStaticJS: function _addStaticJS() {
		var script = this.doc.createElement("script");
		script.type = "text/javascript";
		script.src = path.join(config.publicPath, "js", config.static) + ".js";
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
		jsdom.env(config.path + "/html/" + config.static + ".html", handlEnv);
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

/*
	trinity's send method. This is used by the express layer.

	Overwrite this to do your own sending logic

	@param ServerResponse res - the http response
	@param Error error - an error object
	@param DocumentFragment frag - the document fragment that is being rendered
*/
trinity.send = function _send(res, error, frag) {
	if (error) throw error;
	var doc = frag.ownerDocument;
	doc.body.appendChild(frag);
	res.send(doc.innerHTML);
}

/*
	punch express by overwriting `res.render` to use Trinity
*/
trinity.punchExpress = function _punchExpress() {
	http.ServerResponse.prototype.render = function _render(uri, json) {
		trinity(uri, json, trinity.send.bind(null, this));
	};
}


module.exports = trinity;