'use strict';

exports = module.exports = Router;

var path = require('path');
var inflection = require('inflection');

var Controller = require('./controller');
var Route = require('./route');

var config = require('./../../helpers/config');
var utils = require('./../../helpers/utils');

var debug = require('debug')('fire:router');

function Router(controllerConstructor, filePath) {
	this.delegate = null;
	this.controllerConstructor = controllerConstructor;

	if(controllerConstructor.prototype.basePathComponents) {
		this.basePathComponents = controllerConstructor.prototype.basePathComponents;
	}
	else {
		this.basePathComponents = this.getBasePathComponents(filePath) || [];
	}
}

Router.prototype.getBasePathComponents = function(filePath) {
	var paths = [];

	// `filePath` is the path to the file of the controller. It's optional.
	if(filePath) {
		// We strip the local path up till controllers (we immediately try to make it work on non-*nix).
		paths = path.dirname(filePath.substring(config.basePath.length + (path.sep + 'controllers').length))
			.split(path.sep)
			.filter(function(pathPart) { 
				return pathPart.length; 
			});
	}

	return paths;
};

Router.prototype.getPath = function(verb, method, methodName, basePath) {
	var exp = '^';

	basePath.forEach(function(path) {
		exp += '/' + path + '';
	});

	if(methodName.substring(0, 4) != 'view') {
		var nameWithoutVerb = utils.captureOne(methodName, /^[a-z]+(.*)$/);
		if(nameWithoutVerb && nameWithoutVerb.length) {
			exp += '/' + inflection.transform(nameWithoutVerb, ['pluralize', 'tableize', 'dasherize']);
		}
	}

	var args = utils.getMethodArgumentNames(method);
	args.forEach(function(arg) {
		// If an argument starts with $ we consider it part of the path.
		if(arg[0] == '$') {
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

Router.prototype.getVerb = function(methodName) {
	var transformMap = {
		'create': 'post',
		'update': 'put',
		'view': 'get'
	};

	var verb = utils.captureOne(methodName, /^([a-z]+)/);

	return transformMap[verb] || verb;
};

Router.prototype.getControllerName = function(controllerConstructor) {
	return utils.normalizeClassName(controllerConstructor).toLowerCase();
};

Router.prototype.createRoute = function(methodName) {
	debug('Creating route ' + this.controllerConstructor.name + '#' + methodName + '.');

	var verb = this.getVerb(methodName);
	var path = this.getPath(verb, this.controllerConstructor.prototype[methodName], methodName, this.basePathComponents);
	var argumentNames = utils.getMethodArgumentNames(this.controllerConstructor.prototype[methodName]);

	var route = new Route();
	route.path = path;
	route.verb = verb;
	route.controllerConstructor = this.controllerConstructor;
	route.parseRequest = function(controller, request, response) {
		var index = 0;
		return controller[methodName].apply(controller, argumentNames.map(function(argumentName) {
			if(argumentName[0] == '$') {
				return request.params[index++];
			}
			else {
				return request.body[argumentName];
			}
		}));
	};
	route.sendResponse = function(result, request, response) {
		// TODO: Check the response type e.g. error.
		// TODO: If this is a view, we have to send the view name, or something.

		return response.json(result);
	};
	
	if(this.delegate) {
		this.delegate.addRoute(route);
	}
};

Router.prototype.createRoutes = function() {
	debug('createRoutes ' + this.controllerConstructor.name);
	console.dir(this.controllerConstructor.prototype);
	
	for(var methodName in this.controllerConstructor.prototype) {
		debug('Checking method ' + methodName);

		if(methodName.length && typeof Controller.prototype[methodName] == 'undefined' && typeof this.controllerConstructor.prototype[methodName] == 'function' && methodName[0] != '_') {
			this.createRoute(methodName);
		}
		else {
			debug('Not creating route for `' + methodName + '`.');
		}
	}
};