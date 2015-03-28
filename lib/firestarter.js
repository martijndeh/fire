'use strict';

var path = require('path');
var config = require('./helpers/config');

/**
 * App and Firestarter create a circular require. Set the exports early, before requiring App, so that it's available in App already.
 */
exports = module.exports = new Firestarter();

var AppContainer = require('./app-container');

/**
 * The singleton-ish module orchastrating the modules and apps. Do not construct an instance of this manually. When `require`ing fire, an instance of `Firestarter` is exported. For example:
 *
 * ```
 * var fire = require('fire');
 *
 * // fire is a Firestarter instance
 * ```
 *
 * @constructor
 */
function Firestarter() {
	// TODO: Remove this again in due time. Basically when we generate release.js in the Build module.
	Object.defineProperty(this, 'appsMap', {
		get: function() {
			throw new Error('`fire.appsMap` is removed. Please check `appsContainerMap` now depending on your purposes.');
		}
	});

	this.appsContainerMap = {};
	this.disabled = false;
	this.stage = 'run';

	config.basePath = path.resolve('./');
}

/**
 * Creates a new or returns an existing `App`.
 *
 * If a `options` is specified, a new app will be created. If an app with the same `id` already exists, an exception is thrown.
 *
 * If `options` is not specified, an existing app will be retrieved. If no app with `id` exists, an exception is thrown.
 *
 * For example, to create a new app:
 * ```
 * var fire = require('fire');
 * var app = fire.app('nodeonfire.org', {type: 'angular'});
 *
 * //
 * ```
 *
 * It's possible to create multiple apps which share models and other modules, but serve a different purpose. For example, you can create an admin section and the user-facing app all in the same codebase.
 *
 * ```js
 * // Create the user-facing app
 * var app = fire.app('nodeonfire.org', 'web', {type: 'angular'});
 *
 * // Create an admin app
 * var adminApp = fire.app('nodeonfire.org', 'admin', {type: 'angular'});
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
		app = container.createApp(name || process.env.NODE_APP || 'default', settings);
	}
	else {
		app = container.getApp(name);
	}

	// Please note: when calling fire.app(...) for a second time, it simply returns the cached app (if it's not been removed)
	// regardless of the id. It will also _not_ set any of the options.
	return app;
};

Firestarter.prototype.removeApp = function() {
	throw new Error('`fire#removeApp()` is removed. Please use `fire#stop()` instead.');
};

Firestarter.prototype.start = function() {
	var containerIds = Object.keys(this.appsContainerMap);

	if(!containerIds.length) {
		throw new Error('Could not find any app. Did you create an app in index.js by calling `fire#app()`? Is the current working directory correct?');
	}
	else if(containerIds.length > 1) {
		throw new Error('More than 1 app container found (' + containerIds.join(', ') + '). This is currently not supported. You can create multiple apps by using the same id but different names. Please check `fire#app()`.');
	}

	return this.appsContainerMap[containerIds[0]].start();
};

Firestarter.prototype.stop = function() {
	Object.keys(this.appsContainerMap).forEach(function(id) {
		var container = this.appsContainerMap[id];
		return container.stop();
	}, this);
	this.appsContainerMap = {};
};
