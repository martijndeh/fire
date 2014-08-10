'use strict';

var path = require('path');
var config = require('./helpers/config');

/**
 * App and Firestarter create a circular require. Set the exports early, before requiring App, so that it's available in App already.
 */
exports = module.exports = new Firestarter();

var App = require('./app');

/**
 * The singleton-ish module orchastrating the modules and apps.
 *
 * @api private
 *
 * @constructor
 */
function Firestarter() {
	this.appsMap = {};
	this.disabled = false;

	config.basePath = path.resolve('./');
}

/**
 * Creates a new or returns an existing `App`.
 *
 * It is possible to create multiple apps with different names. Fire will store them in a map internally.  
 *
 * @throws {Error} name must be specified.
 *
 * @param  {String} name The name of the app passed to the App constructor.
 * @param  {Dictionary} opts Passed directly to the app constructor. See App#constructor for more information.
 * @return {App}      The newly created or existing app.
 */
Firestarter.prototype.app = function(name, opts) {
	if(!name) {
		throw new Error('You must specify an app name in fire.app()');
	}

	var app = null;
	if(!this.appsMap[name]) {
		var options = opts || {};
		if(this.disabled) {
			options.disabled = true;
		}

		app = new App(name, options);
		this.appsMap[name] = app;
	}
	else {
		app = this.appsMap[name];
	}

	// Please note: when calling fire.app(...) for a second time, it simply returns the cached app (if it's not been removed)
	// regardless of the name. It will also _not_ set any of the options.

	return app;
};

/**
 * Removes an app from the internal map. Useful when cleaning up during tests.
 *
 * @api private
 *
 * @param {App} app The app to be removed.
 */
Firestarter.prototype.removeApp = function(app) {
	if(this.appsMap[app.name]) {
		delete this.appsMap[app.name];
	}
};
