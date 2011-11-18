var jsdom = require("jsdom"),
	vm = require("vm"),
	fs = require("fs");

var config = {
	"static": "static",
	"publicPath": "trinity"
};

var bodyRegExp = /\{(.+?)\}+$/;



var Loader = {
	loadJavaScript: function _loadJavaScript(uri, cb) {
		var path = config.path + uri + ".js";

		function readFile(err, file) {
			if (err) return cb(err);
			var module = { exports: {} };
			var sandbox = {};
			sandbox.exports = module.exports;
			sandbox.module = module;
			vm.runInNewContext(file, sandbox, path)
			cb(null, module.exports);
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
	load: function _load(uri, json, cb) {
		var count = 2,
			_load = load.bind(null, this.doc, this.cssNode),
			that = this;

		function handleFrag(error, obj) {
			that.frag = obj;
			if (error) return cb(error);
			obj._ownerDocument = that.doc;
			obj.parentNode = null;
			that.loadJavaScript(uri, function (err, func) {
				if (err && err.message.indexOf("No such file") === -1) {
					cb(err);
				}
				func && func(that.frag, json, _load);
				--count === 0 && cb(null, that.frag, _load);	
			});
		}

		function readCSS(err, css) {
			if (err && err.message.indexOf("No such file") === -1) {
				cb(err);
			}
			if (css) {
				that.cssNode.textContent += css;	
			} 
			--count === 0 && cb(null, that.frag, _load);
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

			load(that.doc, that.cssNode, uri, json, cb);
		}

		// load static.html
		jsdom.env(config.path + config.static + ".html", handlEnv);
	}
};

function load(doc, cssNode, uri, json, cb) {
	var l = Object.create(Loader);
	l.doc = doc;
	l.cssNode = cssNode;

	l.load(uri, json, cb);
}

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