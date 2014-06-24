'use strict';

exports = module.exports = Controllers;

var Controller = require('./controller');
var Resources = require('./../../helpers/resources');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:controllers');

var Q = require('q');

function Controllers(app) {
	app.express.use(require('cookie-session')({
		keys: ['Test key 2', 'Test key 1'],
		key: 'sid'
	}));
	app.express.use(require('body-parser')());

	Resources.call(this);

	this.app 	= app;
	this._cache = [];
}
util.inherits(Controllers, Resources);

Controllers.prototype.setup = function(basePath) {
	debug('Controllers#setup');
	
	var cache = this._cache;
	this._cache = null;

	cache.forEach(function(controllerConstructor) {
		this.addControllerConstructor(controllerConstructor);
	}, this);

	return Resources.prototype.setup.call(this, path.join(basePath, 'controllers'));
};

Controllers.prototype.load = function(fullPath) {
	var controllerConstructor = require(fullPath);

	this.loadClass(controllerConstructor, fullPath);
};

Controllers.prototype.addControllerConstructor = function(controllerConstructor) {
	debug('addController ' + controllerConstructor.name);

	if(this._cache) {
		this._cache.push(controllerConstructor);
	}
	else {
		this.loadClass(controllerConstructor, null);
	}
};

Controllers.prototype.loadClass = function(controllerConstructor, fullPath) {
	debug('loadClass `' + controllerConstructor.name + '`.');
	
	// Now we add the controller class (it's actually a constructor) to the controllers.
	// This will build the routes to the controller.

	if(!(controllerConstructor.prototype instanceof Controller)) {
		throw new Error('Controller in `' + fullPath + '` is not an instance of Controller. Did you call fire.controller(...) on your controller?');
	}
	else {
		var router = controllerConstructor.prototype.getRouter(controllerConstructor, fullPath);
		router.delegate = this;
		
		router.createRoutes();
	}
};

Controllers.prototype.addRoute = function(route) {
	debug('addRoute ' + route.verb + ' ' + route.path);

	var self = this;
	this.app.express[route.verb](route.path, function parseConnection(request, response) {
		var TemporaryController = function __TemporaryController() {};
		util.inherits(TemporaryController, route.controllerConstructor);

		var controller = new TemporaryController();
		Controller.call(controller, self.app.models, request, response);

		// TODO: Move this to config.
		controller.configure(process.env.NODE_ENV || 'development');

		Q.when(controller.before())
			.then(function() {
				// TODO: Call the route's action. parseRequest.
				return route.parseRequest(controller, request, response);
			})
			.then(function(result) {
				// TODO: Add another hook to "transform" the result.
				
				return route.sendResponse(result, request, response);
			})
			.then(function() {
				return controller.after();
			})
			.fail(function(error) {
				// TODO: This should go through Route#sendResponse instead.

				response.send(error.status || 500, {
					error: error.message
				});
			})
			.done();
	});
};