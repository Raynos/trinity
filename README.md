# Trinity

A simple templating mechanism, that keeps the purity of HTML, CSS & JS.

Heavy work in progress!

# Example

	// base.html
	<div>
	  <p> Some content </p>
	  <p class="container"></p>
	</div>

	// base.css
	p {
		color: blue
	}

	p.container {
		color: red
	}

	// base.js
	var p = frag.getElementsByClassName("container")[0];
	p.nodeValue = data.text;

	// main.js
	var trinity = require("trinity");
	trinity.config("path", __dirname + "/public/trinity/");

	app.get("/", function (req, res) {
		res.render("base", { text: "win" });
	});

# Motivation

 - [Seperations of concerns][1]. All templating engines break them by putting logic in your views
 - Works on server & client
 - Uses the DOM API everyone knows and loves
 - Really simple API

Doesn't [plates][2] already solve this? Plates makes you dump hooks in your HTML to bind data too. This breaks seperations of concerns. Plates also doesn't let you organize your code into trinities of HTML/CSS/JS that you can inherit and mix & match.

# Documentation

## trinity(uri, data, cb)

Trinity takes an uri to a HTML resource, a data object and a callback. 

It creates a Document based on Static.x

It will then load the HTML at the uri as a fragment and pass it to the JS at the uri.

The javascript file at the uri get's 3 "globals" injected into it. `frag`, `data` and `load`

The CSS file at the uri is string appended to a single CSS node in <head>.

The cb is of format `(error, domFragment, load)`

## load(uri, data, cb)

The load function has the same format as the trinity and can be called to load more HTML/CSS/JS documents as document fragments.

Load does not create a Document based on static.x

The cb parameter takes a format of (error, domFragment, load)

## static.x

Trinity allows you to define a static html / css / js file. These will be loaded by the trinity function. 

The intend is that the static HTML is your master page, and that the static CSS / JS are your bundled & minified production js files.

The HTML that is created for you is the static html page with two extra nodes, a script node pointing at static.js and a style node pointing at static.css

## trinity.config

You can configure some variables.

## trinity.load (Experts only)

You can call the load function directly. Note this means that the CSS doesn't get appended anywhere and that the document fragment has a generic default document as ownerDocument.

Should only be used with HTML & JS. You also have to call adoptNode on the entire document fragment to get it into the correct document.


{
	static: name of static file, default is "static",
	publicPath: the public folder path to your trinity templates, the default is 
		"trinity". This means that a request to /static.css becomes trinity/static.css
	path: the path to your trinity folder. For example __dirname + "/trinity/". It has no
		default.
}

# installation

`npm install trinity`

# tests

`nodeunit tests/`

# contributors

 - Raynos

# MIT Licenced.

  [1]: http://en.wikipedia.org/wiki/Separation_of_concerns
  [2]: https://github.com/flatiron/plates