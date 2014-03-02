exports = module.exports = Models;

var util = require('util');
var Resources = require('./resources');
var path = require('path');
var utils = require('./utils')

function Models() {

}
util.inherits(Models, Resources);

Models.prototype.load = function(fullPath, db) {
	console.log('Load ' + fullPath);
	
	var model = require(fullPath);
	var name = utils.ucfirst(path.basename(fullPath, path.extname(fullPath)));
	this[name] = model(db);

	console.log('Save model to: ' + name);
}

Models.prototype.connect = null;