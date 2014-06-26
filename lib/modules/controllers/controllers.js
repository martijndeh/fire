'use strict';

exports = module.exports = Controllers;

var Controller = require('./controller');
var Resources = require('./../../helpers/resources');

var mu = require('mu2');
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
	var defer = Q.defer();

	debug('Controllers#setup');
	
	// Everything gets added in the cache.
	Resources.prototype.setup.call(this, path.join(basePath, 'controllers'));

	// We delay the execution as the prototype isn't fully declared yet.
	// See Models#setup for more details.
	var self = this;
	setImmediate(function() {
		// We get the cache and invalidate it.
		var cache = self._cache;
		self._cache = null;

		cache.forEach(function(controllerConstructor) {
			self.loadClass(controllerConstructor, null);
		});

		debug('~Controllers#setup');
		defer.resolve();
	});

	return defer.promise;
};

Controllers.prototype.load = function(fullPath) {
	// We load the controller.
	var controllerConstructor = require(fullPath);

	// but we do not expect anything on `exports = module.exports = ...` as nowadays 
	// users should use fire.controller(...) to define models.
	if(controllerConstructor) {
		debug('WARNING: do not set a controller on exports = module.exports = ...;. This is not required anymore.');
	}
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
		debug('parseConnection ' + request.url);

		var TemporaryController = function __TemporaryController() {};
		util.inherits(TemporaryController, route.controllerConstructor);

		var controller = new TemporaryController();
		Controller.call(controller, self.app.models, request, response);

		// TODO: Move this to config.
		controller.configure(process.env.NODE_ENV || 'development');

		Q.when(controller.before())
			.then(function() {
				return route.parseRequest(controller, request, response);
			})
			.then(function(result) {
				// TODO: Add another hook to "transform" the result.
				var type = typeof result;
				if(type == 'object') {
					response.json(result);
				}
				else {
					var stream = mu.compileAndRender(path.join(__dirname, 'assets/view.mu'), {
						_fire: {
							controllerName: route.controllerConstructor.name,
							result: result
						}
					});
					stream.pipe(response);
				}
			})
			.then(function() {
				return controller.after();
			})
			.fail(function(error) {
				debug(error);
				
				// TODO: This should go through Route#sendResponse instead.

				response.send(error.status || 500, {
					error: error.message
				});
			})
			.done();
	});
};