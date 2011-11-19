var express = require("express"),
	trinity = require("../../src/trinity.js");

var app = express.createServer();

trinity.punchExpress();
trinity.set("path", __dirname + "/trinity/");

app.get("/", function (req, res) {
	res.render("base", { text: "win" });
});

app.listen(8080);