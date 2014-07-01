'use strict';

exports = module.exports = Monarch;

var inflection = require('inflection');
var mu = require('mu2');
var path = require('path');

var Q = require('q');

var utils = require('./../../helpers/utils');
var Constructor = require('./constructor');

var debug = require('debug')('fire:monarch');

Monarch.prototype.methodNames = ['animation', 'config', 'constant', 'directive', 'factory', 'filter', 'provider', 'service'];

function Monarch(app) {
	this.app 			= app;
	this.controllers 	= {};
	this.models 		= {};
	this._ 				= [];

	var disabled = this.app.options.disabled;

	// These are angular app.METHOD_NAME methods which we want to be able to use in the client-context.
	// So we declare these methods in the server-context, so that Monarch can export them to the client-context.
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
			};
		}
		else {
			// Noop!
			app[methodName] = function() {};
		}
	});
}

Monarch.prototype.ignoreDisabled = true;

Monarch.prototype.addController = function(controllerConstructor) {
	this.controllers[controllerConstructor.name] = controllerConstructor;
};

Monarch.prototype.addModel = function(modelConstructor) {
	if(modelConstructor.name) {
		this.models[modelConstructor.name] = modelConstructor;
	}
};

Monarch.prototype._renderTo = function(fileName, params, writeStream) {
	var defer = Q.defer();

	var stream = mu.compileAndRender(path.join(__dirname, 'assets/' + fileName), params);
	stream.pipe(writeStream, {end: false});
	stream.on('end', function() {
		defer.resolve(false);
	});

	return defer.promise;
};

Monarch.prototype._generateStart = function(writeStream) {
	return this._renderTo('start.mu', {
		name: this.app.name
	}, writeStream);
};

Monarch.prototype._generateLocalControllers = function(writeStream) {
	var controllerNames = Object.keys(this.controllers);
	if(controllerNames.length > 0) {
		var controllers = [];

		for(var i = 0, il = controllerNames.length; i < il; i++) {
			var controllerName = controllerNames[i];
			var controllerConstructor = this.controllers[controllerName];

			var params = utils.getMethodArgumentNames(controllerConstructor);
			var constructorBody = utils.stripMethodFirstLine(controllerConstructor);
			params.push('function(' + params.map(function(argumentName) {
				return argumentName;
			}).join(', ') + ') ' + constructorBody);

			controllers.push({
				name: controllerName,
				params: params.map(function(paramName, index, array) {
					if(index == (array.length - 1)) {
						return paramName;
					}
					else {
						return '\'' + paramName + '\'';
					}
				}).join(', ')
			});
		}

		return this._renderTo('controllers.mu', {
			controllers: controllers
		}, writeStream);
	}

	return Q.when(false);
};

Monarch.prototype._generateModels = function(writeStream) {
	var modelNames = Object.keys(this.models);
	if(modelNames.length > 0) {
		var models = [];
		for(var i = 0, il = modelNames.length; i < il; i++) {
			models.push({
				name: modelNames[i],
				resource: inflection.pluralize(inflection.dasherize(modelNames[i])).toLowerCase()
			});
		}

		return this._renderTo('models-service.mu', {models: models}, writeStream);
	}

	return Q.when(false);
};

Monarch.prototype._generateConstructors = function(writeStream) {
	this._.forEach(function(constructor) {
		// TODO: Generate angular things.
	});
};

Monarch.prototype._closeWriteStream = function(writeStream) {
	writeStream.end();
};

Monarch.prototype.load = function() {
	var self = this;
	this.app.models.forEach(function(model) {
		self.addModel(model.constructor);
	});

	this.app.controllers.forEach(function(controllerConstructor) {
		self.addController(controllerConstructor);
	});
};

Monarch.prototype.generate = function(writeStream) {
	var self = this;
	return this._generateStart(writeStream)
		.then(function() {
			return self._generateLocalControllers(writeStream);
		})
		.then(function() {
			return self._generateModels(writeStream);
		})
		.then(function() {
			return self._generateConstructors(writeStream);
		})
		.then(function() {
			return self._closeWriteStream(writeStream);
		})
		.fail(function(error) {
			throw error;
		});
};
