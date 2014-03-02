exports = module.exports = Resources;

var fs = require('fs');
var path = require('path');

function Resources() {
	
}

Resources.prototype.setup = function(basePath, extra) {	
	//todo: pass along all arguments to the load calls

	fs.readdirSync(basePath).forEach(function(resourceFileName) {
		if(resourceFileName.length && resourceFileName[0] != '_' && resourceFileName[0] != '.') {
			var fullPath = path.join(basePath, resourceFileName);
			if(fs.lstatSync(fullPath).isDirectory()) {
				this.setup(fullPath, extra);
			}
			else {
				this.load(fullPath, extra);
			}
		}
	}.bind(this));
}