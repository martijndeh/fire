'use strict';

exports = module.exports = Bridge;

var mu = require('mu2');
var path = require('path');
var Q = require('q');
var stream = require('stream');
var Constructor = require('./constructor');

var debug = require('debug')('fire:bridge');

/**
 * The bridge module generates app-specific JavaScript libraries to be used in the client-context.
 *
 * To generate the JavaScript, run the following command in your app's root directory:
 *
 * 	$ fire generate scripts
 *
 * The creates 1 file named fire.js in the _assets directory. This fire.js file contains all client-side code:
 *
 * It's not possible yet to include additional scripts, for example, angular or angular-route, but in the future this will be possible.
 *
 * @param {App} app The app which loads this module.
 * @constructor
 */
function Bridge(app) {
	this.app 			= app;
	this._ 				= [];

	var disabled = this.app.options.disabled;

	// These are angular app.METHOD_NAME methods which we want to be able to use in the client-context.
	// So we declare these methods in the server-context, so that Bridge can export them to the client-context.
	var self = this;
	this.methodNames.forEach(function(methodName) {
		debug('Setting app.' + methodName + '(...).');

		if(disabled) {
			if(app[methodName]) {
				// TODO: We should swizzle existing methods so we can keep replacement logic in here.
			}

			app[methodName] = function() {
				// We want this to work with whatever arguments.
				var constructor = new Constructor(methodName);

				for(var i = 0, il = arguments.length; i < il; i++) {
					constructor.arguments.push(arguments[i]);
				}

				self._.push(constructor);
				return app;
			};
		}
		else {
			app[methodName] = function() {
				return app;
			};
		}
	});
}

/**
 * A list of method names which get proxied to the angular module.
 *
 * The controller method is missing, because that one is added by the Controllers module.
 *
 * @const
 */
Bridge.prototype.methodNames = ['animation', 'config', 'constant', 'directive', 'factory', 'filter', 'provider', 'service'];

/**
 * This module will be loaded when the app is run in disabled mode.
 *
 * @api private
 */
Bridge.prototype.ignoreDisabled = true;

/**
 * Generates the client-side fire.js by executing all generators local in ./generators.
 *
 * Please note: this method will close the write stream by calling fs.WriteStream#end once it succeeds.
 *
 * @param  {fs.WriteStream} writeStream An opened stream to write to.
 * @return {Promise}             Resolves when succeeded. Rejects when fails.
 */
Bridge.prototype.generate = function(writeStream) {
	if(!this.app.models._loaded) {
		throw new Error('Models are not loaded.');
	}

	function renderGenerator(generator) {
		var defer = Q.defer();

		var readStream = mu.compileAndRender(path.join(__dirname, 'templates/' + generator.fileName), generator.options);
		readStream.pipe(writeStream, {end: false});

		if(writeStream instanceof stream.Writable) {
			writeStream.on('finish', function() {
				defer.resolve(false);
			});

			readStream.on('end', function() {
				defer.resolve(false);
			});
		}
		else {
			// The memory stream unfortunately does not emit the finish event. Instead, we'll listen when reading ends.
			readStream.once('end', function() {
				defer.resolve(false);
			});
		}

		return defer.promise;
	}

	var generatorNames = ['init', 'local-controllers', 'models', 'fire-controllers'];

	var result = Q.when(true);

	var self = this;
	generatorNames.forEach(function(generatorName) {
		result = result.then(function() {
			return renderGenerator(require('./generators/' + generatorName + '.js').apply(self, []));
		});
	});

	return result
		.then(function() {
			return writeStream.end();
		})
		.catch(function(error) {
			console.log(error);
			console.log(error.stack);

			throw error;
		});
};
