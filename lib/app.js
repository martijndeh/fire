'use strict';

var Controllers = require('./modules/controllers');
var Static = require('./modules/static');
var Models = require('./modules/models');
var API = require('./modules/api');
var Bridge = require('./modules/bridge');
var Templates = require('./modules/templates');
var SEO = require('./modules/seo');

var Bridge = require('./modules/bridge');

var config = require('./helpers/config');
var fire = require('./firestarter');

var inflection = require('inflection');
var express = require('express');

var Q = require('q');

var debug = require('debug')('fire:app');

exports = module.exports = App;

/**
 * Initialize a new `App` for both the client- and server-context. A new app is usually created via {@link Firestarter#app}.
 *
 * In the client-context, this creates an angular.Module with `name` and requires from `options.modules`. This instance also acts as a proxy to the angular.Module. This means that you can invoke `directive`, `controller` or any of the angular.Module methods. For a complete list, see {@link Bridge} or angular's Module documentation at {@link https://docs.angularjs.org/api/ng/type/angular.Module}.
 *
 * @param {String} name    Name of the app.
 * @param {Dictionary} options
 * @param {!Array.<String>=} options.modules List of requires passed to angular.Module.
 * @constructor
 */
function App(name, options) {
	this.name = name || 'app';
	this.options = options || {};
	this.modules = [];
	this.configureFunctions = [];
	this.server = null;
	if(!this.options.disabled) {
		debug('App is not disabled.');

		this.express = express();
		this.express.disable('x-powered-by');
	}
	else {
		debug('App is disabled.');
	}

	this.addModule(SEO);
	this.addModule(Templates);
	this.addModule(Models);
	this.addModule(API);
	this.addModule(Static);
	this.addModule(Controllers);
	this.addModule(Bridge);
}

/**
 * Sets up a model. This is a convenient method. For a full explanation see Models#model.
 *
 * @param  {Models~ModelConstructor} modelConstructor The model to be created.
 * @return {App} This.
 */
App.prototype.model = function(modelConstructor) {
	this.models.model(modelConstructor);
	return this;
};

/**
 * Sets up a controller. This is a convenient method. See Controllers#controller for a full explanation.
 *
 * @param  {Controllers~ControllerConstructor} controllerConstructor The controller to be created.
 * @return {App} This.
 */
App.prototype.controller = function(controllerConstructor) {
	this.controllers.controller(controllerConstructor);
	return this;
};

/**
 * Adds a new module to the app.
 *
 * @param {Constructor} moduleConstructor The module constructor which gets invoked with 1 param: this app instance.
 * @return {App} This.
 */
App.prototype.addModule = function(moduleConstructor) {
	if(this.options.disabled && !moduleConstructor.prototype.ignoreDisabled) {
		debug('Not loading module `' + moduleConstructor.name + '`.');
	}
	else {
		var module_ = new moduleConstructor(this);
		this.modules.push(module_);

		// We get the name of the property based on the name of the constructor
		var propertyName = inflection.camelize(moduleConstructor.name, true);

		Object.defineProperty(this, propertyName, {
			value: module_
		});
	}
	return this;
};

/**
 * Sets a configure function to be run in the server-context right before the app starts. This is useful because code may be invoked when generating code, migrations and so on. The configureFunction is guaranteed only to be run when the app starts.
 *
 * You may invoke this method multiple times to configure multiple functions. If you return a promise, the start up of the app continues once the promise resolves.
 *
 * @param {Function} configureFunction The function to run. The first param is the value of the NODE_ENV environmentable value.
 * @return {App} This.
 */
App.prototype.configure = function(configureFunction) {
	this.configureFunctions.push(configureFunction);
	return this;
};

/**
 * Stops the app and closes the HTTP server.
 *
 * @return {Promise} Resolves when closing of the server finishes, or rejects when an error occurs.
 */
App.prototype.stop = function() {
	var defer = Q.defer();

	fire.removeApp(this);

	if(this.server) {
		this.server.close(defer.makeNodeResolver());
	}
	else {
		defer.resolve();
	}

	return defer.promise;
};

/**
 * Starts the app by setting up all modules, invoking all configure functions, starting the HTTP server and binding to the value of PORT defined in the environmental table.
 *
 * This method should not be be invoked multiple times (even after calling App#stop).
 *
 * @return {Promise}
 */
App.prototype.run = function() {
	debug('App#run');

	if(this.options.disabled) {
		debug('Cancelling App#run because of app disabled');
		return Q.when(null);
	}

	if(this.server) {
		throw new Error('Must not call App#run multiple times.');
	}

	var self = this;
	return (function _setup(app) {
		debug('App#_setup');

		var result = Q.when(true);

		app.modules.forEach(function(module_) {
			result = result.then(function() {
				// TODO: Create a noop.
				return Q.when((module_.setup || function(){}).call(module_, config.basePath));
			});
		});

		return result
			.then(function() {
				var environment = (process.env.NODE_ENV || 'development');

				result = Q.when(true);
				app.configureFunctions.forEach(function(configureFunction) {
					result = result.then(function() {
						return Q.when(configureFunction(environment));
					});
				});

				return result;
			});
	})(this)
		.then(function setupServer() {
			var port = null;

			if(process.env.NODE_ENV == 'test') {
				//
			}
			else {
				if(!process.env.PORT) {
					debug('PORT environment variable not set. Setting to default port 3000.');
				}

				port = (process.env.PORT || 3000);
			}

			if(port) {
				debug('Start server on http://127.0.0.1:' + port + '/');
			}
			else {
				debug('Start server on http://127.0.0.1/');
			}

			// We resolve the promise with the return value from Server#listen.
			self.server = self.express.listen(port);
			return self.server;
		})
		.catch(function(error) {
			console.log(error);
			console.log(error.stack);
			console.log('Error when starting, bleh.');
			throw error;
		});
};
