'use strict';

var path = require('path');
var config = require('./helpers/config');
var Q = require('q');

/**
 * App and Firestarter create a circular require. Set the exports early, before requiring App, so that it's available in App already.
 */
exports = module.exports = Firestarter;

var AppContainer = require('./app-container');

Firestarter.app = function() {
	throw new Error('firestarter.js now exports Firestarter constructor instead of a Firestarter instance. Please change your code.');
};

/**
 * The isomorphic fire service. This service is available in both the front- and the back-end.
 *
 * The service contains two methods to check at runtime whether your code is running on the client- or the server-side, respectively, {@link Firestarter#isClient} and {@link Firestarter#isServer}.
 *
 * The below example illustrates the usage of the service:
 * ```
 * app.run(function(fire) {
 * 	if(fire.isServer()) {
 * 		// The server.
 * 	}
 * 	else {
 * 		// The client.
 * 	}
 * });
 * ```
 *
 * On the back-end, the service is also responsible for orchastrating the modules and apps. You do not need to construct an instance of fire yourself.
 *
 * @constructor
 */
function Firestarter() {
	this.appsContainerMap = {};
	this.disabled = false;
	this.stage = 'run';
	this._isStarting = false;
	this.setMaxListeners(30);

	config.basePath = path.resolve('./');
}

var events = require('events');
var util = require('util');
util.inherits(Firestarter, events.EventEmitter);

/**
 * Returns true if the code is running on the client-side.
 */
Firestarter.prototype.isClient = function() {
	return false;
};

/**
 * Returns true if the code is running on the server-side.
 */
Firestarter.prototype.isServer = function() {
	return true;
};

/**
 * Creates a new or returns an existing `App`.
 *
 * If a `options` is specified, a new app will be created. If an app with the same `id` already exists, an exception is thrown.
 *
 * If `options` is not specified, an existing app will be retrieved. If no app with `id` exists, an exception is thrown.
 *
 * For example, to create a new app:
 * ```
 * var app = require('fire')('nodeonfire.org', {type: 'angular'});
 *
 * //
 * ```
 *
 * It's possible to create multiple apps which share models and other modules, but serve a different purpose. For example, you can create an admin section and the user-facing app all in the same codebase.
 *
 * ```js
 * // Create the user-facing app
 * var app = require('fire')('nodeonfire.org', 'web', {type: 'angular'});
 *
 * // Create an admin app
 * var adminApp = require('fire')('nodeonfire.org', 'admin', {type: 'angular'});
 * ```
 *
 * In the build and run phase you set the `NODE_APP` environment variable to specify which app to return.
 *
 * If you retrieve an app without a name and the `NODE_APP` is set, that app is returned. If `NODE_APP` is not set, an app named `default` is returned.
 *
 * @param  {String} id The identifier of the app passed to the App constructor. This is usually the app's domain e.g. nodeonfire.org.
 * @param  {String} name The name of the app, defaults to 'default'.
 * @param  {Dictionary} settings Passed directly to the app constructor. See {@link App} for more information.
 * @return {App}      The newly created or existing app.
 */
Firestarter.prototype.app = function(id, name_, settings_) {
	if(!id) {
		throw new Error('You must specify an app id in `fire.app()`.');
	}

	var settings = null;
	var name = null;

	if(typeof name_ == 'object') {
		settings = name_;
	}
	else {
		name = name_;
		settings = settings_;
	}

	if(settings) {
		if(this.disabled) {
			settings.disabled = true;
		}

		if(!settings.type) {
			settings.type = 'angular';
		}
	}

	var container = null;
	if(!this.appsContainerMap[id]) {
		container = new AppContainer(id, this.stage);
		this.appsContainerMap[id] = container;
	}
	else {
		container = this.appsContainerMap[id];
	}

	var app = null;
	if(settings) {
		app = container.createApp(name || process.env.NODE_APP || id, settings);
	}
	else {
		app = container.getApp(name);
	}

	// Please note: when calling fire.app(...) for a second time, it simply returns the cached app (if it's not been removed)
	// regardless of the id. It will also _not_ set any of the options.
	return app;
};

Firestarter.prototype.start = function() {
	var defer = Q.defer();

	if(!this._isStarting) {
		this._isStarting = true;

		var self = this;
		setImmediate(function() {
			self._start()
				.then(function() {
					defer.resolve();
				})
				.catch(function(error) {
					defer.reject(error);
				})
				.done();
		});
	}
	else {
		this.once('start', function() {
			defer.resolve();
		});
	}

	return defer.promise;
};

Firestarter.prototype._start = function() {
	var containerIds = Object.keys(this.appsContainerMap);

	if(!containerIds.length) {
		throw new Error('Could not find any app. Did you create an app in index.js by calling `fire#app()`? Is the current working directory correct?');
	}
	else if(containerIds.length > 1) {
		throw new Error('More than 1 app container found (' + containerIds.join(', ') + '). This is currently not supported. You can create multiple apps by using the same id but different names. Please check `fire#app()`.');
	}

	var self = this;
	return this.appsContainerMap[containerIds[0]].start()
		.then(function(result) {
			self.emit('start');
			return result;
		});
};

Firestarter.prototype.stop = function() {
	var result = Q.when(true);

	Object.keys(this.appsContainerMap).forEach(function(id) {
		var container = this.appsContainerMap[id];

		result = result.then(function() {
			return container.stop();
		});
	}, this);
	this.appsContainerMap = {};

	var self = this;
	return result
		.then(function(ret) {
			self._isStarting = false;
			return ret;
		});
};
