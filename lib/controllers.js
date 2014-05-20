exports = module.exports = Controllers;

var util = require('util');
var Controller = require('./controller');
var Resources = require('./resources');

var url = require('url');
var utils = require('./utils');
var path = require('path');
var config = require('./config');

var Q = require('q');

function Controllers(app) {
	Resources.call(this);

	this.app = app;
}
util.inherits(Controllers, Resources);

Controllers.prototype.load = function(fullPath, models) {
	var controllerClass = require(fullPath);

	this.loadClass(controllerClass, fullPath, models);
};

Controllers.prototype._createViewPath = function(controllerName, methodName) {
	var matches = /^([a-z0-9]+)/.exec(methodName);

	var viewName = methodName;
	if(matches && matches.length > 1 && matches['input'] != matches[1]) {
		viewName = methodName.substring(matches[1].length).toLowerCase();
	}

	return path.join(config.basePath, 'views', controllerName, viewName);
}

Controllers.prototype._createPath = function(method, paths) {
	var arguments = utils.getMethodArgumentNames(method);

	var exp = '^';

	paths.forEach(function(path) {
		exp += '/' + path + '';
	});

	arguments.forEach(function(arg) {
		var location = arg.indexOf('$');

		if(location == -1) {
			exp += '/(' + arg + ')';
		}
		else {
			exp += '/([^/]+)';
		}
	});

	if(exp.length == 1) {
		exp += '/';
	}
	else {
		exp += '(?:/)?';
	}

	exp += '$';

	return new RegExp(exp, 'i');
}

Controllers.prototype._transformVerb = function(verb) {
	var transformMap = {
		'create': 'post',
		'update': 'put'
	};

	return transformMap[verb] || verb;
};

Controllers.prototype._setupRoutes = function(fullPath, ControllerClass) {
	var paths = path.dirname(fullPath.substring(config.basePath.length + '/controllers'.length)).split('/').filter(function(path) { return path.length; });

	// Name of the controller, without ...Controller$.
	var controllerName = utils.normalizeClassName(ControllerClass).toLowerCase();

	for(var methodName in ControllerClass.prototype) {
		if(methodName.length && typeof Controller.prototype[methodName] == 'undefined' && typeof ControllerClass.prototype[methodName] == 'function' && methodName[0] != '_') {
			var url = this._createPath(ControllerClass.prototype[methodName], paths);
			var verb = this._transformVerb(utils.captureOne(methodName, /^([a-z]+)/));

			this.app.addRoute(verb, url, ControllerClass, ControllerClass.prototype[methodName], this._createViewPath(controllerName, methodName));
		}
	}
};

Controllers.prototype.loadClass = function(ControllerClass, fullPath) {
	for(var methodName in Controller.prototype) {
		if(Controller.prototype[methodName]) {
			ControllerClass.prototype[methodName] = Controller.prototype[methodName];
		}
	}

	this._setupRoutes(fullPath, ControllerClass);
	return ControllerClass;
};