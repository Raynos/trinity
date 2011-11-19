var div = frag.firstChild;
div.className = data.bar;
load("simple", {}, function (error, docfrag) {
	div.appendChild(docfrag);
});
