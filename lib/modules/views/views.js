exports = module.exports = Views;

var Resources = require('./../../helpers/resources');
var config = require('./../../helpers/config');

var express = require('express');
var util = require('util');
var path = require('path');

function Views(app) {
	app.server.engine('html', require('jade').__express);
	app.server.engine('jade', require('jade').__express);
	app.server.use(require('less-middleware')(path.join(config.basePath, 'private'), {
		dest: path.join(config.basePath, 'public')
	}));
	app.server.use(express.static(path.join(config.basePath, 'public')));

	Resources.call(this);

	//a map of all views without file extension
	this.viewPaths = {};
}
util.inherits(Views, Resources);

Views.prototype.setup = function(basePath) {
	Resources.prototype.setup.call(this, path.join(basePath, 'views'));
};

Views.prototype.load = function(fullPath) {
	var name = fullPath.substring(0, fullPath.length - path.extname(fullPath).length);

	if(this.viewPaths[name]) {
		console.log('WARNING: multiple views of the same name exists. Please note Node on Fire is ignoring extension. The conflicting view is ' + name + '.');
	}

	this.viewPaths[name] = fullPath;
};

Views.prototype.getFullPath = function(viewPath) {
	return this.viewPaths[viewPath];
};