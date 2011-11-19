var p = frag.firstChild.getElementsByClassName("container")[0];
p.textContent = data.text;
load("child", data, function (error, fragment) {
	var div = frag.firstChild;
	div.appendChild(fragment);
});