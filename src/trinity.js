var jsdom = require("jsdom"),
	vm = require("vm"),
	fs = require("fs");

var config = {
	"static": "static",
	"publicPath": "trinity"
};

var bodyRegExp = /\{(.+?)\}+$/;


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


var Loader = {
	loadJavaScript: function _loadJavaScript(uri, cb) {
		var path = config.path + uri + ".js";

		function readFile(err, file) {
			if (err) return cb(err);
			var f = Function("frag", "data", "load", file);
			cb(null, f);
		}

		fs.readFile(path, readFile);
	},
	createDocumentFragment: function _createDocumentFragment(uri, cb) {
		function readFile(error, file) {
			if (error) return cb(error);
			var doc = jsdom.jsdom(file);
			var fragment = doc.createDocumentFragment();
			[].forEach.call(doc.childNodes, function (node) {
				fragment.appendChild(node);
			});
			cb(null, fragment);
		}
	
		fs.readFile(config.path + uri + ".html", readFile);
	},
	make: function _make(doc, cssNode) {
		var l = Object.create(Loader);
		l.doc = doc;
		l.cssNode = cssNode;
		return l;
	},
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
			that.count--;
			if (err && err.message.indexOf("No such file") === -1) {
				return cb(error);
			}
			if (css) {
				that.cssNode.textContent += css;	
			}
			next();
		}
		
		// load html into fragment
		this.createDocumentFragment(uri, handleFrag);

		fs.readFile(config.path + uri + ".css", readCSS);
	}
};
	

var Trinity = {
	addStaticCSS: function _addStaticCSS() {
		var style = this.doc.createElement("style");
		style.type = "text/css";
		style.src = config.publicPath + "/" + config.static + ".css";
		this.doc.head.appendChild(style);
	}, 
	addStaticJS: function _addStaticJS() {
		var script = this.doc.createElement("script");
		script.type = "text/javascript";
		script.src = config.publicPath + "/" + config.static + ".js";
		this.doc.head.appendChild(script);	
	},
	addEmptyCSSNode: function _addEmptyCSSNode() {
		var style = this.doc.createElement("style");
		style.type = "text/css";
		style.id = "trinity-css-container";
		this.cssNode = style;
		this.doc.head.appendChild(style);
	},
	load: function (uri, json, cb) {
		var that = this;

		function handlEnv(err, window) {

			if (err && err.length) return cb(errors);

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

function trinity(module, json, cb) {
	var doc; 

	if (typeof json === "function") {
		cb = json;
		json = null;
	}

	var t = Object.create(Trinity);
	t.load(module, json, cb);
};

trinity.set = function (name, val) {
	config[name] = val;
};


module.exports = trinity;