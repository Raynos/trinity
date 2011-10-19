var after = require("after"),
	error = require("error"),
	fs = require("fs"),
	pd = require("pd"),
	Stack = require("stack"),
	path = require("path");

var loadStack = (function () {
	function _loadHTMLAndCheckExistance(templateName, tmpl) {
		var next = after(3, this.next);

		this.storeData({
			fun: path.exists.bind(path),
			args: [
				path.join(
					Trinity.config.path, 
					"css", 
					Trinity.config.static + ".css"
				)
			],
			key: "cssExists",
			cb: next
		});

		this.storeData({
			fun: tmpl._loadStatic.bind(tmpl),
			args: [],
			key: "static",
			cb: next
		});

		this.storeData({
			fun: path.exists.bind(path), 
			args: [
				path.join(
					Trinity.config.path, 
					"js", 
					Trinity.config.static + ".js"
				)
			], 
			key: "jsExists", 
			cb: next
		});
	}

	function _transformStatic(templateName) {
		// TODO: don't assume </head> exists
		var arr = this.static.toString().split("</head>"),
			first = arr[0],
			last = arr[1];

		if (this.cssExists) {
			first += "<link rel='stylesheet' " +
				"href='" + Trinity.config.clientPath + "/css/" +
				Trinity.config.static + ".css'></link>\n";
		}

		if (this.jsExists) {
			first += "<script type='text/javascript' " +
				"src='" + Trinity.config.clientPath + "/js/" +
				Trinity.config.static + ".js'></script>\n";
		}

		first += "<script type='text/javascript'>" +
			"(function () { trinity.load('" + templateName + "'); } )();</script>\n";

		var html = first + last;
		this.html = html;
		console.log("loading html");
		return this.next();
	}

	return pd.new(Stack, 
		_loadHTMLAndCheckExistance,
		_transformStatic
	);
})();

var Template = {
	_load: function _load(templateName, cb) {
		var pathName = path.join(
			Trinity.config.path, "html", templateName + ".html");

		fs.readFile(pathName, function _readFile(err, file) {
			cb(err, file);
		});
	},
	_loadStatic: function _loadMaster(cb) {
		this._load(Trinity.config.static, cb);
	},
	load: function _load(templateName, cb) {
		loadStack.handle({
			data: [templateName, this],
			floor: function _floor() {
				cb(null, this.html);
			}
		});
	},
	
}

var Trinity = {
	config: {
		static: "static"
	},
	end: function _end(res, templateName) {
		Template.load(templateName, error.throw(function (err, html) {
			res.writeHead(200, {
				"Content-Length": html.length,
				"Content-Type": "text/html"
			});
			res.end(html);
		}));
	},
	set: function _set(key, value) {
		this.config[key] = value;
	}
};

module.exports = {
	Trinity: Trinity,
	Template: Template
};