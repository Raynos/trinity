var trinity = require("../src/trinity.js");

module.exports = {
	"trinity set config": function (test) {
		test.expect(3);
		test.ok(trinity);
		test.ok(trinity.set);
		trinity.set("path", __dirname + "/trinity/");
		trinity("test.html", {}, function (docfrag, data, trinity) {
			test.ok(docfrag);
			test.done();
		});
	},
	"trinity works with basic html": function (test) {
		trinity("test.html", {}, function (docfrag, data, trinity) {
			
		});
	}
};