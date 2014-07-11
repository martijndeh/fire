'use strict';

exports = module.exports = Controllers;

var Controller = require('./controller');
var Resources = require('./../../helpers/resources');
var Template = require('./template');

var config = require('./../../helpers/config');
var mu = require('mu2');
var util = require('util');
var path = require('path');
var debug = require('debug')('fire:controllers');

var Q = require('q');

function Controllers(app) {
	// When the app is disabled, we do not have an express instance.
	if(app.express) {
		var keys = ['1038641b2d8e106ea60850034b43d7a9'];

		if(process.env.SESSION_KEYS) {
			keys = process.env.SESSION_KEYS.split(',');
		}
		else {
			if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {

			}
			else {
				console.log('WARNING: Specify SESSION_KEYS in your .env to properly configure cookie session.');
			}
		}

		app.express.use(require('cookie-session')({
			keys: keys,
			name: 'sid'
		}));
		app.express.use(require('body-parser')());
	}

	Resources.call(this);

	this.app 	= app;
	this._cache = [];
	this._controllers = {};
}
util.inherits(Controllers, Resources);

Controllers.prototype.ignoreDisabled = true;

Controllers.prototype.forEach = function(callback) {
	var controllerNames = Object.keys(this._controllers);
	for(var i = 0, il = controllerNames.length; i < il; i++) {
		var controllerConstructor = this._controllers[controllerNames[i]];
		callback(controllerConstructor);
	}
};

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

		this._controllers[controllerConstructor.name] = controllerConstructor;
	}
};

Controllers.prototype.addRoute = function(route) {
	if(!this.app.express) {
		return;
	}

	var self = this;

	// If this is a view route, simply add it to the views instead.
	if(route.isView) {
		debug('addTemplate ' + route.templatePath);

		this.app.express.get(route.templatePath, function(request, response) {
			// TODO: Include global options from ... somewhere.
			var html = self.app.templates.template(route.template.name);
			if(!html) {
				response.send(404);
			}
			else {
				response.send(200, html);
			}
		});

		debug('addView ' + route.path);

		this.app.express.get(route.path, function parseView(request, response) {
			var options = {
				_fire: {
					appName: self.app.name
				},
				stylesheets: self.app.options.stylesheets || [],
				scripts: self.app.options.scripts || []
			};

			var html = self.app.templates.template('view.jade');
			if(html) {
				response.send(200, html);
			}
			else {
				response.render(path.join(__dirname, 'assets', 'view.jade'), options, function(error, html) {
					if(error) {
						throw error;
					}
					else {
						response.send(200, html);
					}
				});
			}
		});
	}
	else {
		debug('addRoute ' + route.verb + ' ' + route.path);

		this.app.express[route.verb](route.path, function parseConnection(request, response) {
			debug('parseConnection ' + request.url);

			// TODO: Cache this instance and do not allocate a new instance on every request.
			var TemporaryController = function __TemporaryController() {};
			util.inherits(TemporaryController, route.controllerConstructor);

			var controller = new TemporaryController();
			Controller.call(controller, self.app.models, request, response);

			controller.configure(process.env.NODE_ENV || 'development');

			Q.when(controller.before())
				.then(function() {
					return route.method.apply(controller, route.argumentNames.map(function(argumentName) {
						if(argumentName[0] == '$' && argumentName.length > 1) {
							return request.params[argumentName.substring(1)];
						}
						else {
							return request.param(argumentName);
						}
					}));
				})
				.then(function(result) {
					// TODO: Add another hook to "transform" the result.
					// TODO: Return a promise in this scope, resolve it later on (in callbacks/stream).
					if(result) {
						response.json(result);
					}
					else {
						response.send(404);
					}
				})
				.then(function() {
					return controller.after();
				})
				.catch(function(error) {
					debug(error);

					// TODO: This should go through Route#sendResponse instead.

					response.send(error.status || 500, {
						error: error.message
					});
				})
				.done();
		});
	}
};
