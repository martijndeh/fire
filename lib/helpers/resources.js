exports = module.exports = Resources;

var utils = require('./utils');

function Resources() {
	//
}

Resources.prototype.setup = function(basePath, extra) {
	// TODO: instead of using this as a base constructor, simply create a method with a callback instead. Much simpler.

	var self = this;
	utils.readDirSync(basePath, function(fullPath) {
		return self.load(fullPath, extra);
	});
};
