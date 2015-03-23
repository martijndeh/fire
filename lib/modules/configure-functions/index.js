'use strict';

exports = module.exports = ConfigureFunctions;

var Q = require('q');

/**
 * Configures.
 *
 * @param {Function} configureFunction The function to call during run phase.
 * @name App#configure
 * @function
 */

/**
 * The configure module creates App#configure which...:
 *
 * Sets a configure function to be run in the server-context right before the app starts. This is useful because code may be invoked when generating code, migrations and so on. The configureFunction is guaranteed only to be run when the app starts.
 *
 * You may invoke this method multiple times to configure multiple functions. If you return a promise, the start up of the app continues once the promise resolves. The function is only invoked on the web process.
 *
 * For example:
 *
 * ```
 * var app = fire.app('myTestApp', {modules: ['ngRoute']});
 *
 * app.configure(function(environment) {
 * 	// Do something
 * });
 *
 * fire.start();
 * ```
 * @constructor
 */
function ConfigureFunctions(app) {
	this.configureFunctions = [];
	this.app = app;

	var self = this;
	app.configure = function(configureFunction) {
		if(self.configureFunctions === null) {
			configureFunction.call(app, (process.env.NODE_ENV || 'development'));
		}
		else {
			self.configureFunctions.push(configureFunction);
		}

		return app;
	};
}
ConfigureFunctions.prototype.stages = ['build', 'release', 'run'];

/**
 * Executes all App#configure functions. This is only invoked on the web process.
 */
ConfigureFunctions.prototype.start = function(argv) {
	// In test mode we always are in the run phase.
	if(process.env.NODE_ENV != 'test' && (!argv.web && Object.keys(argv).length > 1 || !this.app.HTTPServer.express)) {
		return Q.when(false);
	}

	var environment = (process.env.NODE_ENV || 'development');

	var result = Q.when(true);

	var self = this;
	this.configureFunctions.forEach(function(configureFunction) {
		result = result.then(function() {
			// TODO: Should this get called in web or worker processes? or in tasks too?
			return Q.when(configureFunction.call(self.app, environment));
		});
	});

	return result
		.then(function() {
			self.configureFunctions = null;
		});
};
