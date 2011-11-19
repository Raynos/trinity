var document = frag.ownerDocument;
var el = document.createElement("div");
frag.appendChild(el);
if (data) {
	frag.firstChild.textContent = data.baz;
}