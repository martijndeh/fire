'use strict';

var Injector = require('./modules/injector');
var Controllers = require('./modules/controllers');
var Static = require('./modules/static');
var Models = require('./modules/models');
var API = require('./modules/api');
var Bridge = require('./modules/bridge');
var Templates = require('./modules/templates');
var Bridge = require('./modules/bridge');
var Workers = require('./modules/workers');
var HTTPServer = require('./modules/http-server');
var ConfigureFunctions = require('./modules/configure-functions');
var Tasks = require('./modules/tasks');
var WebSockets = require('./modules/websockets');
var Channels = require('./modules/channels');
var ModuleProperties = require('./modules/module-properties');
var Triggers = require('./modules/triggers');
var Clock = require('./modules/clock');
var Schedulers = require('./modules/schedulers');
var Middleware = require('./modules/middleware');
var Tests = require('./modules/tests');
var Isomorphic = require('./modules/isomorphic');

var utils = require('./helpers/utils');
var config = require('./helpers/config');
var fs = require('fs');

var AppContainer = require('./app-container');

var path = require('path');
var inflection = require('inflection');

var Q = require('q');
var minimist = require('minimist');
var debug = require('debug')('fire:app');

exports = module.exports = App;

/**
 * Initialize a new `App` for both the client- and server-context. A new app is usually created via {@link Firestarter#app}.
 *
 * In the client-context, this creates an `angular.Module` with `name` and requires from `settings.modules`. This instance also acts as a proxy to the `angular.Module`. This means that you can invoke `directive`, `controller` or any of the `angular.Module` methods.
 *
 * For a complete list, angular's Module documentation at {@link https://docs.angularjs.org/api/ng/type/angular.Module}.
 *
 * @param {String} name    Name of the app.
 * @param {Dictionary} settings
 * @param {String} settings.type The type of the app, either angular or ractive.
 * @param {Array} settings.modules List of requires passed to angular.Module.
 * @param {Boolean} settings.isMaster Whether this app is the master. A master app is responsible for any shared models and other dependencies.
 *
 * @constructor
 */
function App(name, settings, container) {
	debug('Creating app `' + name + '` ' + JSON.stringify(settings) + '.');

	this.name = name;
	this._settings = settings || {};
	this.container = container;

	Object.defineProperty(this, 'type', {
		get: function() {
			throw new Error('App#type is deprecated. Use App#settings(\'type\') instead.');
		}
	});

	if(!this._settings.type) {
		this._settings.type = 'angular';
	}

	if(typeof this._settings.modules == 'undefined') {
		this._settings.modules = ['ngRoute'];
	}

	this.modules = [];
	this._loadModules();
}

App.prototype.isRunStage = function() {
	return (this.container.stage == 'run');
};

App.prototype.isBuildStage = function() {
	return (this.container.stage == 'build');
};

App.prototype.isReleaseStage = function() {
	return (this.container.stage == 'release');
};

App.prototype.settings = function(key, value) {
	if(typeof value == 'undefined') {
		return this._settings[key];
	}
	else {
		this._settings[key] = value;
		return value;
	}
};

App.prototype._loadModules = function() {
	// TODO: Load these modules automatically?

	this.addModule(Injector);
	this.addModule(Templates);
	this.addModule(Models);
	this.addModule(Controllers);
	this.addModule(Bridge);
	this.addModule(Clock);
	this.addModule(API);
	this.addModule(Workers);
	this.addModule(Triggers);
	this.addModule(HTTPServer);
	this.addModule(Middleware);
	this.addModule(ConfigureFunctions);
	this.addModule(Static);
	this.addModule(Tasks);
	this.addModule(Schedulers);
	this.addModule(WebSockets);
	this.addModule(Channels);
	this.addModule(Tests);
	this.addModule(ModuleProperties);
	this.addModule(Isomorphic);
};

App.prototype.requireDirSync = function(dirPath, all) {
	if(this.container.numberOfApps() == 1) {
		utils._requireDirSync(dirPath);
	}
	else if(all) {
		this.settings('_sharedMode', true);

		utils._requireDirSync(path.join(dirPath, AppContainer.kSharedAppName));

		this.settings('_sharedMode', false);

		Object.keys(this.container.appsMap).forEach(function(appName) {
			this.container.setActiveApp(this.container.appsMap[appName]);
			utils._requireDirSync(path.join(dirPath, appName));
			this.container.setActiveApp(null);
		}, this);
	}
	else {
		this.settings('_sharedMode', true);

		utils._requireDirSync(path.join(dirPath, AppContainer.kSharedAppName));

		this.settings('_sharedMode', false);

		utils._requireDirSync(path.join(dirPath, this.name));

		// Only check in development mode as we do not want to increase start-up time of the app in production.
		if(process.env.NODE_ENV != 'production' && fs.existsSync(dirPath)) {
			var self = this;
			fs.readdirSync(dirPath).forEach(function(resourceFileName) {
				if(resourceFileName.length && resourceFileName[0] != '_' && resourceFileName[0] != '.') {
					var fullPath = path.join(dirPath, resourceFileName);
					if(!fs.lstatSync(fullPath).isDirectory()) {
						throw new Error('Not loading file `' + resourceFileName + '`. You have multiple apps and the file is not in one of the app folders or the `_shared` folder.');
					}
					else if(resourceFileName != AppContainer.kSharedAppName) {
						try {
							self.container.getApp(resourceFileName);
						}
						catch(e) {
							console.log(e);

							throw new Error('Found folder `' + resourceFileName + '` but no app of this names exists. The active app is `' + self.name + '`. If this folder should be loaded, be sure to create an app with the same name. If it should not be loaded, please rename the folder to `_' + resourceFileName + '`.');
						}
					}
				}
			});
		}
	}
};

/**
 * Adds a new module to the app.
 *
 * @param {Constructor} moduleConstructor The module constructor which gets invoked with 1 param: this app instance.
 * @return {App} The app instance-so this method is chainable.
 */
App.prototype.addModule = function(moduleConstructor) {
	if(typeof moduleConstructor.prototype.ignoreDisabled != 'undefined') {
		throw new Error('Module#ignoreDisabled is deprecated. Please use Module#stages to indicate which stages the module should be available.');
	}

	if(typeof moduleConstructor.prototype.stages == 'undefined') {
		throw new Error('Module#stages is undefined. Please set which stages `' + moduleConstructor.name + '` should run.');
	}

	var stages = moduleConstructor.prototype.stages;

	if(this._settings.disabled && stages.indexOf(this.container.stage) == -1) {
		debug('Not loading module `' + moduleConstructor.name + '`.');
	}
	else {
		var module_ = new moduleConstructor(this);
		this.modules.push(module_);

		// We get the name of the property based on the name of the constructor
		var propertyName = inflection.camelize(moduleConstructor.name, (moduleConstructor.name.length <= 1 || moduleConstructor.name.substring(1, 2).toLowerCase() == moduleConstructor.name.substring(1, 2)));

		if(this[propertyName]) {
			throw new Error('Module `' + propertyName + '` already exists.');
		}

		debug('Adding module `' + propertyName + '`.');

		Object.defineProperty(this, propertyName, {
			value: module_,
			configurable: true
		});

		this.injector.register(propertyName, function() {
			return module_;
		});
	}
	return this;
};

App.prototype.isActive = function() {
	return (this.container.numberOfApps() == 1 || this.container.getActiveAppName() == this.name);
};

/**
 * Removes a module.
 *
 * ```
 * app.removeModule(app.webSockets);
 * ```
 */
App.prototype.removeModule = function(module_) {
	var index = this.modules.indexOf(module_);
	if(index >= 0) {
		this.modules.splice(index, 1);

		var propertyName = inflection.camelize(module_.constructor.name, (module_.constructor.name.length <= 1 || module_.constructor.name.substring(1, 2).toLowerCase() == module_.constructor.name.substring(1, 2)));
		this.injector.unregister(propertyName);
		delete this[propertyName];
	}
};

/**
 * Stops the app. This also invokes the `stop` method on all modules.
 *
 * @return {Promise} Resolves when closing of the server finishes, or rejects when an error occurs.
 */
App.prototype.stop = function() {
	debug('Stopping app `' + this.name + '`.');

	var stoppingModules = [];

	this.modules.forEach(function(module_) {
		if(module_.stop) {
			stoppingModules.push(module_.stop());
		}
	});

	return Q.all(stoppingModules);
};

/**
 * Starts the app.
 *
 * This method is deprecated. Please use `fire#start()` instead.
 *
 * @deprecated
 */
App.prototype.start = function() {
	throw new Error('This method is deprecated. Please use `fire#start()` instead.');
};

/**
 * Starts the app by setting up all modules, invoking all configure functions, starting the HTTP server and binding to the value of PORT defined in the environmental table.
 *
 * This method should not be be invoked multiple times (even after calling App#stop).
 *
 * @return {Promise}
 */
App.prototype._start = function() {
	debug('App#_start');

	if(this._settings.disabled) {
		debug('Cancelling App#start because of app disabled');
		return Q.when(null);
	}

	var argv = minimist(process.argv.slice(2));
	this.injector.register('argv', function() {
		return argv;
	});

	var self = this;
	return (function setupModules(app) {
		debug('App#setup');

		var result = Q.when(true);

		app.modules.forEach(function(module_) {
			result = result.then(function() {
				debug(module_.constructor.name + '#setup');

				// TODO: use dependency injection. We really should pass the argv in here.
				return Q.when((module_.setup || function(){}).call(module_, config.basePath));
			});
		});

		return result;
	})(this)
		.then(function startModules() {
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
			throw error;
		});
};
