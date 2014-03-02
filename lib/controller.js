exports = module.exports = Controller;

var path = require('path');
var Route = require('./route');
var config = require('./config');
var utils = require('./utils');

function Controller(fullPath, models) {
	this.fullPath = fullPath;

	//sub folder in controllers directory
	this.paths 	= path.dirname(fullPath.substring(config.basePath.length + '/controllers'.length)).split('/').filter(function(path) { return path.length; });

	//file name of the controller, without extension
	this.name 	= path.basename(fullPath, path.extname(fullPath));

	//models, obviously
	this.models = models;

	//connection-specific values--only set after controller is cloned
	this.connection = null;
	this.body = null;
	this.cookies = null;
}

Controller.prototype._clone = function(controller) {
	this.fullPath = controller.fullPath;
	this.paths = controller.paths;
	this.name = controller.name;
	this.models = controller.models;

	//do not clone the connection, body, cookies, etc--they are connection specific
}

Controller.prototype._createPath = function(method) {
	var arguments = utils.getMethodArgumentNames(method);
	
	var exp = '^';

	this.paths.forEach(function(path) {
		exp += '/(' + path + ')';
	});

	arguments.forEach(function(arg) {
		var location = arg.indexOf('$');

		if(location == -1) {
			exp += '/(' + arg + ')';
		}
		else {
			exp += '/([^/]+)';
		}
	})

	if(exp.length == 1) {
		exp += '/';
	}
	else {
		exp += '(?:/)?';
	}

	exp += '$';

	return new RegExp(exp, 'gi');
}

Controller.prototype._createViewPath = function(methodName) {
	var matches = /^([a-z0-9]+)/.exec(methodName);

	var viewName = methodName;
	if(matches && matches.length > 1 && matches['input'] != matches[1]) {
		viewName = methodName.substring(matches[1].length).toLowerCase();
	}

	return path.join(config.basePath, 'views', this.name, viewName);
}

Controller.prototype._createRoutes = function() {
	var routes = [];

	for(var methodName in this) {
		if(methodName.length && methodName[0] != '_' && typeof this[methodName] == 'function') {
			routes.push(new Route(this._createPath(this[methodName]), this._createViewPath(methodName), this, this[methodName], utils.captureOne(methodName, /^([a-z]+)/), this.filter));
		}
	}

	return routes;
}