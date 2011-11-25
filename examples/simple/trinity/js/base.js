var p = frag.firstChild.getElementsByClassName("container")[0];
p.textContent = data.text;
var fragment = load("child", data);
var div = frag.firstChild;
div.appendChild(fragment);