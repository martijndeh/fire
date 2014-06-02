'use strict';

exports = module.exports = Controllers;

var util = require('util');
var Controller = require('./controller');

var Resources = require('./../../helpers/resources');
var utils = require('./../../helpers/utils');
var config = require('./../../helpers/config');

var url = require('url');
var path = require('path');
var Q = require('q');

var debug = require('debug')('fire:http');

function Controllers(app) {
	app.server.use(require('cookie-session')({
		keys: ['Test key 2', 'Test key 1'],
		key: 'sid'
	}));
	app.server.use(require('body-parser')());

	Resources.call(this);

	this.app = app;
}
util.inherits(Controllers, Resources);

Controllers.prototype.setup = function(basePath) {
	return Resources.prototype.setup.call(this, path.join(basePath, 'controllers'));
};

Controllers.prototype.load = function(fullPath) {
	var controllerConstructor = require(fullPath);

	this.loadClass(controllerConstructor, fullPath);
};

Controllers.prototype._setupRoutes = function(controllerConstructor, fullPath) {
	var paths = controllerConstructor.prototype.getBasePath(fullPath);

	// Name of the controller, without ...Controller$.
	var controllerName = controllerConstructor.prototype.getName(controllerConstructor);

	for(var methodName in controllerConstructor.prototype) {
		// If it's a method on the Controller prototype, we assume it's not a public route.
		// If the method starts with a _ we also exclude it from the routes.

		if(methodName.length && typeof Controller.prototype[methodName] == 'undefined' && typeof controllerConstructor.prototype[methodName] == 'function' && methodName[0] != '_') {
			var url = controllerConstructor.prototype.getPath(controllerConstructor.prototype[methodName], methodName, paths);
			var verb = controllerConstructor.prototype.getVerb(methodName);
			var viewPath = controllerConstructor.prototype.getViewPath(controllerName, methodName);

			// TODO: Clean this up.
			this.addRoute(verb, url, controllerConstructor, controllerConstructor.prototype[methodName], viewPath);
		}
	}
};

Controllers.prototype.loadClass = function(controllerConstructor, fullPath) {
	// Now we add the controller class (it's actually a constructor) to the controllers.
	// This will build the routes to the controller.

	if(!(controllerConstructor.prototype instanceof Controller)) {
		throw new Error('Controller in `' + fullPath + '` is not an instance of Controller. Did you call fire.controller(...) on your controller?');
	}
	else {
		this._setupRoutes(controllerConstructor, fullPath);
		return controllerConstructor;
	}
};

Controllers.prototype._configureConnection = function(controllerConstructor, action, viewPath) {
	// TODO: Move this to the controllers...

	var fullViewPath = this.app.views.getFullPath(viewPath);

	var app = this.app;
	return function parseConnection(request, response) {
		// Create the actual controller. We allocate a new instance per request so we won't share any data between requests.
		var controller = new controllerConstructor();
		Controller.call(controller, app.models, request, response);

		// Call the -before.
		var result = false;
		if(controller.before) {
			result = controller.before();
		}
		else {
			result = true;
		}

		Q.when(result)
			.then(function() {
				// Call the action.
				return action.apply(controller, Object.keys(request.params).map(function(key) {
					return request.params[key];
				}));
			})
			.then(function(result) {
				if(fullViewPath) {
					debug('View path is for `' + viewPath + '` is `' + fullViewPath + '`.');

					response.render(fullViewPath, result);
				}
				else {
					response.json(result);
				}
			})
			.fail(function(error) {
				if(fullViewPath) {
					response.send(error.status || 500, error.message);
				}
				else {
					response.send(error.status || 500, {
						error: error.message
					});
				}
			})
			.done();
	};
};

Controllers.prototype.addRoute = function(verb, url, controllerConstructor, action, viewPath) {
	if(this.app.server[verb] && typeof this.app.server[verb] == 'function') {
		this.app.server[verb].call(this.app.server, url, this._configureConnection(controllerConstructor, action, viewPath));
	}
	else {
		debug('Invalid verb `' + verb + '` in controller `' + controllerConstructor.name + '`.')
	}
};