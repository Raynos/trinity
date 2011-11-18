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
	module.exports = function (domFragment, data, trinity) {
		var p = domFragment.getElementsByClassName("container")[0];
		p.nodeValue = data.text;
	};

	// main.js
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

Trinity takes an uri to a HTML resource, a data object and a callback. It will then load the HTML at the uri as a fragment and pass it to the JS at the uri.

The javascript file at the uri takes a format of 

`module.exports = function (domFragment, data, load) { };`

The domFragment is created from the HTML at the uri, the data was passed in to the outer trinity function and the 3rd parameter is the inner trinity.

The load function has the same format as the trinity and can be called to load more HTML/CSS/JS documents as document fragments.

The cb parameter takes a format of (domFragment, data, load) just like the js function.

## static.x

Trinity allows you to define a static html / css / js file. These will be loaded by the trinity function. The intend is that the static HTML is your master page, and that the static CSS / JS are your bundled & minified production js files.

# installation

`npm install trinity`

# tests

`nodeunit tests/`

# contributors

 - Raynos

# MIT Licenced.

  [1]: http://en.wikipedia.org/wiki/Separation_of_concerns
  [2]: https://github.com/flatiron/plates