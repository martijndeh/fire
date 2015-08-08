'use strict';

exports = module.exports = Bridge;

var mu = require('mu2');
var path = require('path');
var Q = require('q');
var config = require('./../../helpers/config');
var Constructor = require('./constructor');
var stream = require('stream');

/**
 * The Bridge module compiles Mustache templates to client-side JavaScript libraries in the build phase. All JavaScript is concatenated in a single fire.js file.
 *
 * Modules can extend Bridge's functionality by including a generator method which returns a {@link Generator} instance. For example:
 * ```
 * function MyModule(app) {
 * 	this.app = app;
 * }
 *
 * MyModule.prototype.generator = function() {
 * 	return new this.app.bridge.Generator(path.join(__dirname, 'templates', this.app.settings('type'), 'my-module.js'), {
 * 		// Module data here.
 * 	});
 * };
 * ```
 *
 * @param {App} app The app which loads this module.
 * @constructor
 */
function Bridge(app) {
	this.app 			= app;
	this._ 				= [];

	var disabled = this.app.settings('disabled');

	this.configMap = (require('./' + app.settings('type')));

	if(!this.configMap) {
		throw new Error('Invalid app type `' + app.settings('type') + '`. There is no Bridge module available for this type. The following types are valid: `angular`, `ractive`.');
	}

	// These are angular app.METHOD_NAME methods which we want to be able to use in the client-context.
	// So we declare these methods in the server-context, so that Bridge can export them to the client-context.
	var self = this;
	this.configMap.methodNames.forEach(function(methodName) {
		var existingMethod = app[methodName];

		// If the app is disabled we're not in a run stage.
		if(disabled) {
			app[methodName] = function() {
				// We want this to work with whatever arguments.
				var constructor = new Constructor(methodName);

				for(var i = 0, il = arguments.length; i < il; i++) {
					constructor.arguments.push(arguments[i]);
				}

				self._.push(constructor);

				if(existingMethod) {
					return existingMethod.apply(app, constructor.arguments);
				}
				else {
					return app;
				}
			};
		}
		else {
			// We're adding the method anyway, else invoking this method in user-land when the app is not disabled will result in an error.

			app[methodName] = function() {
				if(existingMethod) {
					var args = [];
					for(var i = 0, il = arguments.length; i < il; i++) {
						args.push(arguments[i]);
					}

					return existingMethod.apply(app, args);
				}
				else {
					return app;
				}
			};
		}
	});
}

/**
 * Exposes the {@link Generator} constructor. This is useful for modules implementing the `generator` method.
 */
Bridge.prototype.Generator = require('./generator');

/**
 * This module will be loaded when the app is run in disabled mode.
 *
 * @access private
 */
Bridge.prototype.stages = ['build', 'release', 'run'];

/**
 * Generates the client-side fire.js by executing all generators local in ./generators.
 *
 * In addition, every module may provide a generator if it implements a `generator` method. Bridge loops over every module and executes it's `generator` method (if it exists). The `generator` method should return an instance of {@link Generator}.
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

		mu.root = path.dirname(generator.filePath);

		var readStream = mu.compileAndRender(generator.filePath, generator.options);

		var removeListeners = function() {
			readStream.removeListener('end', resolveCallback);
			readStream.removeListener('error', rejectCallback);
		};

		var resolveCallback = function() {
			removeListeners();

			defer.resolve();
		};
		var rejectCallback = function(error) {
			removeListeners();

			defer.reject(error);
		};

		readStream.once('end', resolveCallback);
		readStream.once('error', rejectCallback);

		readStream.pipe(writeStream, {end: false});
		return defer.promise;
	}

	var result = Q.when(true);
	var self = this;

	this.configMap.directoryNames.forEach(function(directoryName) {
		self.app.requireDirSync(path.join(config.basePath, directoryName));
	});

	var generatorNames = ['init', 'controllers', 'models', 'routes'];

	generatorNames.forEach(function(generatorName) {
		result = result.then(function() {
			return renderGenerator(require('./generators/' + generatorName + '.js').apply(self, []));
		});
	});

	// bridge asks every module if it wants to generate something
	this.app.modules.forEach(function(module_) {
		if(module_.generator) {
			result = result.then(function() {
				return renderGenerator(module_.generator());
			});
		}
	});

	return result
		.then(function() {
			var defer = Q.defer();

			if(writeStream instanceof stream.Writable) {
				writeStream.once('finish', function() {
					defer.resolve();
				});

				writeStream.once('error', function(error) {
					defer.reject(error);
				});
			}
			else {
				defer.resolve();
			}

			writeStream.end();
			return defer.promise;
		})
		.catch(function(error) {
			throw error;
		});
};
