exports = module.exports = Controller;

var path = require('path');
var config = require('./config');
var utils = require('./utils');

function Controller(models, request, response) {
	this.models = models;
	this.session = request.session;
	this.body = request.body;

	this.__request = request;
	this.__response = response;
}

Controller.prototype.param = function(name) {
	return this.__request.param(name);
};

Controller.prototype.getBasePath = function(fullPath) {
	// `fullPath` is the path to the file of the controller.
	// We strip the local path up till controllers (we immediately try to make it work on non-*nix).
	return path.dirname(fullPath.substring(config.basePath.length + (path.sep + 'controllers').length))
		.split(path.sep)
		.filter(function(pathPart) { 
			return pathPart.length; 
		});
};

Controller.prototype.getPath = function(method, paths) {
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
};

Controller.prototype.getViewPath = function(controllerName, methodName) {
	var matches = /^([a-z0-9]+)/.exec(methodName);

	var viewName = methodName;
	if(matches && matches.length > 1 && matches['input'] != matches[1]) {
		viewName = methodName.substring(matches[1].length).toLowerCase();
	}

	return path.join(config.basePath, 'views', controllerName, viewName);
};

Controller.prototype.getVerb = function(methodName) {
	var transformMap = {
		'create': 'post',
		'update': 'put'
	};

	var verb = utils.captureOne(methodName, /^([a-z]+)/);

	return transformMap[verb] || verb;
};

Controller.prototype.getName = function(controllerConstructor) {
	return utils.normalizeClassName(controllerConstructor).toLowerCase()
};

// This should be excluded from auto-route generations.
Controller.prototype.before = null;