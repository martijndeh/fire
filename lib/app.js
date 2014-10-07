'use strict';

var Controllers = require('./modules/controllers');
var Static = require('./modules/static');
var Models = require('./modules/models');
var API = require('./modules/api');
var Bridge = require('./modules/bridge');
var Templates = require('./modules/templates');
var SEO = require('./modules/seo');
var Bridge = require('./modules/bridge');
var Workers = require('./modules/workers');
var HTTPServer = require('./modules/http-server');

var config = require('./helpers/config');
var fire = require('./firestarter');

var inflection = require('inflection');

var Q = require('q');
var minimist = require('minimist');
var debug = require('debug')('fire:app');

exports = module.exports = App;

/**
 * Initialize a new `App` for both the client- and server-context. A new app is usually created via {@link Firestarter#app}.
 *
 * In the client-context, this creates an `angular.Module` with `name` and requires from `options.modules`. This instance also acts as a proxy to the `angular.Module`. This means that you can invoke `directive`, `controller` or any of the `angular.Module` methods.
 *
 * For a complete list, angular's Module documentation at {@link https://docs.angularjs.org/api/ng/type/angular.Module}.
 *
 * @param {String} name    Name of the app.
 * @param {Dictionary} options
 * @param {Array} options.modules List of requires passed to angular.Module.
 *
 * @constructor
 */
function App(name, options) {
	this.name = name || 'app';
	this.options = options || {};
	this.modules = [];

	// TODO: Move configureFunctions to another module.
	this.configureFunctions = [];

	this.addModule(SEO);
	this.addModule(Templates);
	this.addModule(Models);
	this.addModule(Static);
	this.addModule(Controllers);
	this.addModule(Bridge);
	this.addModule(API);
	this.addModule(Workers);
	this.addModule(HTTPServer);
}

/**
 * Adds a new module to the app.
 *
 * @param {Constructor} moduleConstructor The module constructor which gets invoked with 1 param: this app instance.
 * @return {App} The app instance-so this method is chainable.
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
 * @return {App} The app instance-so this method is chainable.
 */
App.prototype.configure = function(configureFunction) {
	if(this.configureFunctions === null) {
		configureFunction.call(this, (process.env.NODE_ENV || 'development'));
	}
	else {
		this.configureFunctions.push(configureFunction);
	}

	return this;
};

/**
 * Stops the app and closes the HTTP server.
 *
 * @return {Promise} Resolves when closing of the server finishes, or rejects when an error occurs.
 */
App.prototype.stop = function() {
	fire.removeApp(this);

	var stoppingModules = [];

	this.modules.forEach(function(module_) {
		if(module_.stop) {
			stoppingModules.push(module_.stop());
		}
	});

	return Q.all(stoppingModules);
};

/**
 * This is method is deprecated. Use {@link App#start} instead.
 *
 * @return {App}
 */
App.prototype.run = function() {
	console.log('WARNING: App#run is deprecated. Use App#start instead.');

	return this.start();
};

/**
 * Starts the app by setting up all modules, invoking all configure functions, starting the HTTP server and binding to the value of PORT defined in the environmental table.
 *
 * This method should not be be invoked multiple times (even after calling App#stop).
 *
 * @return {Promise}
 */
App.prototype.start = function() {
	debug('App#start');

	if(this.options.disabled) {
		debug('Cancelling App#start because of app disabled');
		return Q.when(null);
	}

	if(this.server) {
		throw new Error('Must not call App#run multiple times.');
	}

	var self = this;
	return (function _setup(app) {
		debug('App#setup');

		var result = Q.when(true);

		app.modules.forEach(function(module_) {
			result = result.then(function() {
				return Q.when((module_.setup || function(){}).call(module_, config.basePath));
			});
		});

		return result
			.then(function() {
				var environment = (process.env.NODE_ENV || 'development');

				result = Q.when(true);
				app.configureFunctions.forEach(function(configureFunction) {
					result = result.then(function() {
						return Q.when(configureFunction.call(app, environment));
					});
				});

				return result;
			})
			.then(function() {
				app.configureFunctions = null;
			});
	})(this)
		.then(function startModules() {
			var argv = minimist(process.argv.slice(2));
			var startingModules = [];

			self.modules.forEach(function(module_) {
				if(module_.start) {
					startingModules.push(module_.start(argv));
				}
			});

			return Q.all(startingModules);
		})
		.catch(function(error) {
			console.log(error);
			console.log(error.stack);
			console.log('Error when starting, bleh.');
			throw error;
		});
};
