'use strict';

exports = module.exports = Controllers;

var Controller = require('./controller');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:controllers');
var inflection = require('inflection');
var Q = require('q');
var config = require('./../../helpers/config');

/**
 * The Controllers module.
 *
 * @param {App} app The app initializing this module.
 *
 * @constructor
 */
function Controllers(app) {
	// When the app is disabled, we do not have an express instance.

	this.app 	= app;
	this._cache = [];
	this._controllers = {};

	var self = this;
	var appType = app.settings('type');
	if(appType == 'angular' || appType == 'ractive') {
		app.controller = function(controllerPath, controllerConstructor) {
			if(controllerConstructor) {
				self.controller(controllerPath, controllerConstructor);
			}
			else {
				self.controller(null, controllerPath);
			}
		};
	}
	else {
		throw new Error('Unknown app type `' + appType + '`. Maybe this is only available in a future Node on Fire version?');
	}
}

/**
* Sets up a controller.
*
* The `controllerConstructor` gets inherited by {@link Controller} and the constructor gets added to the system so routes can be generated and additional code can be generated.
*
* Please note: the constructor itself, is __never__ executed in the server-context. Instead, the constructor is passed to angular's controller method and a controller is created on the client-context.
*
* ```js
* function MyController($scope) {
* 	console.log(MyController);
* }
* app.controller(MyController);
*
* MyController.prototype.view = function() {
* 	return this.template('index');
* };
* ```
*
* The Bridge module is responsible for generating the client-context controller. This Controllers module checks the controllerConstructor's prototype and creates any routes.
*
* @param  {Constructor} controllerConstructor The named controller constructor.
*/
Controllers.prototype.controller = function(controllerPath, controllerConstructor) {
	util.inherits(controllerConstructor, Controller);

	// We delay because when app.controller(MyController) is called, we have to wait before the complete prototype is set.
	var self = this;
	setImmediate(function() {
		self.addControllerConstructor(controllerPath, controllerConstructor);
	});
};

Controllers.prototype.stages = ['build', 'release', 'run'];

/**
 * Convenience method to loop over all controllers.
 *
 * @access private
 *
 * @param {Function} callback(controllerConstructor) The callback function is invoked for every controller.
 */
Controllers.prototype.forEach = function(callback) {
	var controllerNames = Object.keys(this._controllers);
	for(var i = 0, il = controllerNames.length; i < il; i++) {
		var controllerConstructor = this._controllers[controllerNames[i]];
		callback(controllerConstructor);
	}
};

/**
 * Loads all files in the `controllers/` directory and sets up all already loaded controllers.
 *
 * Setup is invoked by the app when it's starting up.
 *
 * @access private
 *
 * @param  {String} basePath The root path of the project.
 * @return {Promise}
 */
Controllers.prototype.setup = function(basePath) {
	var defer = Q.defer();

	debug('Controllers#setup');

	// Everything gets added in the cache.
	if(basePath) {
		debug(path.join(basePath, 'controllers'));

		this.app.requireDirSync(path.join(basePath, 'controllers'));
	}

	// We delay the execution as the prototype isn't fully declared yet.
	// See Models#setup for more details.
	var self = this;
	setImmediate(function() {
		if(self._cache === null) {
			throw new Error('Controller\'s cache is empty. Controllers#setup probably invoked twice. This is not allowed as it will result in unexpected behavior.');
		}

		// We get the cache and invalidate it.
		var cache = self._cache;
		self._cache = null;

		cache.forEach(function(controller) {
			self.loadControllerConstructor(controller.path, controller.constructor, null);
		});

		debug('~Controllers#setup (' + Object.keys(self._controllers).length + ' controllers)');

		defer.resolve();
	});

	return defer.promise;
};

/**
 * Adds `controllerConstructor` to the load queue, or loads the constructor if setup already finished.
 *
 * If the controllers are already loaded (the setup is finished) immediately loads a controller. Because the constructor's prototype might not be completely set yet, this method delays execution with a setImmediate.
 *
 * @access private
 *
 * @param {Constructor} controllerConstructor The controller constructor to be loaded.
 */
Controllers.prototype.addControllerConstructor = function(controllerPath, controllerConstructor) {
	debug('addController ' + controllerConstructor.name);

	if(this._cache) {
		this._cache.push({
			path: controllerPath,
			constructor: controllerConstructor
		});
	}
	else {
		this.loadControllerConstructor(controllerPath, controllerConstructor, null);
	}
};

/**
 * Loads the controller and creates the routes based on the controller's methods.
 *
 * There is no separate routing table, but the router creates the routes based on the controllers' methods. For more information on route, see Router.
 *
 * @access private
 *
 * @param {Constructor} controllerConstructor
 * @param {String} fullPath              The path to the constructor's file
 */
Controllers.prototype.loadControllerConstructor = function(controllerPath, controllerConstructor, fullPath) {
	debug('loadControllerConstructor `' + controllerConstructor.name + '`.');

	// Now we add the controller class (it's actually a constructor) to the controllers.
	// This will build the routes to the controller.

	if(!(controllerConstructor.prototype instanceof Controller)) {
		throw new Error('Controller in `' + fullPath + '` is not an instance of Controller. Did you call app.controller(...) on your controller?');
	}

	var controllerPaths = [];
	if(Array.isArray(controllerPath)) {
		controllerPaths = controllerPath.map(function(path) {
			return {path: path};
		});
	}
	else if(controllerPath) {
		controllerPaths = [{path: controllerPath}];
	}

	if(controllerPaths) {
		this.addViewRoute(controllerPaths, controllerConstructor);
	}

	if(this._controllers[controllerConstructor.name]) {
		this._controllers[controllerConstructor.name].paths = this._controllers[controllerConstructor.name].paths.concat(controllerPaths);
	}
	else {
		this._controllers[controllerConstructor.name] = {
			paths: controllerPaths,
			templatePath: '/templates/' + inflection.dasherize(inflection.underscore(controllerConstructor.name.replace(/Controller$/, '')).toLowerCase()) + '.html',
			constructor: controllerConstructor,
			tests: []
		};
	}
};

/**
 * Creates a view route to the path which returns the main template.
 *
 * @param {String} controllerPath        The path of the view.
 * @param {String} controllerConstructor The controller.
 */
Controllers.prototype.addViewRoute = function(controllerPaths, controllerConstructor) {
	if(!this.app.HTTPServer || !this.app.HTTPServer.express) {
		return;
	}

	var page = null;
	var self = this;

	if(controllerConstructor.prototype.page) {
		page = controllerConstructor.prototype.page();
	}

	if(!page) {
		page = {};
	}

	if(!page.template) {
		page.template = 'view';
	}

	var options = self.app._settings || {};
	options._fire = {
		appName: self.app.name
	};

	if(page.styles) {
		options.styles = page.styles;
	}

	if(page.scripts) {
		options.scripts = page.scripts;
	}

	if(!Array.isArray(controllerPaths)) {
		throw new Error('Controllers#addViewRoute requires first parameter to be an array.');
	}

	controllerPaths.forEach(function(controllerPath) {
		this.app.HTTPServer.express.get(controllerPath.path, function parseView(request, response) {
			var html = self.app.templates.template(page.template);
			if(html) {
				response.status(200).send(html);
			}
			else {
				var templatePath;
				if(self.app.container.numberOfApps() > 1) {
					templatePath = '.fire/.build/public/' + self.app.name + '/templates/' + page.template + '.html';
				}
				else {
					templatePath = '.fire/.build/public/templates/' + page.template + '.html';
				}

				response.render(path.join(config.basePath, templatePath), options, function renderView(error, text) {
					if(error) {
						throw error;
					}
					else {
						response.status(200).send(text);
					}
				});
			}
		});
	}, this);
};
