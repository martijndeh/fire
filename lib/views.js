exports = module.exports = Views;

var util = require('util');
var Resources = require('./resources');
var path = require('path');
var View = require('./view');

function Views() {
	Resources.call(this);

	//a map of all views without file extension
	this.viewPaths = {};
}
util.inherits(Views, Resources);

Views.prototype.load = function(fullPath) {
	var name = fullPath.substring(0, fullPath.length - path.extname(fullPath).length);

	if(this.viewPaths[name]) {
		console.log('WARNING: multiple views of the same name exists. Please note Node on Fire is ignoring extension. The conflicting view is ' + name + '.');
	}
	this.viewPaths[name] = fullPath;
}

Views.prototype.getView = function(route) {
	return new View(this.viewPaths[route.viewPath], route.caller.render || this.render);
}

Views.prototype.render = function(filePath, models) {
	//nothingness
}