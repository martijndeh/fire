'use strict';

exports = module.exports = ConfigureFunctions;

/**
 * This method has been deprecated. Please use {@link StageMethods#run} instead.
 *
 * @param {Function} configureFunction The function to call during run phase.
 * @name App#configure
 * @function
 */

/**
 * The configure module has been deprecated. Please use the {@link StageMethods} module instead.
 *
 * @constructor
 */
function ConfigureFunctions(app) {
	this.configureFunctions = [];
	this.app = app;

	// TODO: Move this somewhere else.
	app.injector.register('environment', function() {
		return (process.env.NODE_ENV || 'development');
	});

	app.configure = function() {
		var error = 'App#configure has been deprecated. Please use App#run instead. App#build and App#release are also available.';
		console.log(error);
		throw new Error(error);
	};
}
ConfigureFunctions.prototype.stages = ['build', 'release', 'run'];
