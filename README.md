# Trinity

A new way to render templates. You split all your templates into a trinity of three files (html, css, js) and they are just glued together using the trinity API.

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
	module.exports = function (domFragment, trinity, data) {
		var p = domFragment.getElementsByClassName("container");
		p.nodeValue = data.text;
	};

Heavy work in progress!