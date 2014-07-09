'use strict';

exports = module.exports = Bridge;

var inflection = require('inflection');
var mu = require('mu2');
var path = require('path');
var util = require('util');
var Q = require('q');

var utils = require('./../../helpers/utils');
var Constructor = require('./constructor');
var Router = require('./../controllers/router');

var debug = require('debug')('fire:bridge');

Bridge.prototype.methodNames = ['animation', 'config', 'constant', 'directive', 'factory', 'filter', 'provider', 'service'];

function Bridge(app) {
	this.app 			= app;
	this.controllers 	= {};
	this.models 		= {};
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
			// Noop!
			app[methodName] = function() {
				return app;
			};
		}
	});
}

Bridge.prototype.ignoreDisabled = true;

Bridge.prototype.addController = function(controllerConstructor) {
	this.controllers[controllerConstructor.name] = controllerConstructor;
};

Bridge.prototype.addModel = function(model) {
	var modelName = model._name;
	if(modelName) {
		this.models[model._name] = model;
	}
};

Bridge.prototype._renderTo = function(fileName, params, writeStream) {
	var defer = Q.defer();

	var stream = mu.compileAndRender(path.join(__dirname, 'assets/' + fileName), params);
	stream.pipe(writeStream, {end: false});
	stream.on('end', function() {
		defer.resolve(false);
	});

	return defer.promise;
};

Bridge.prototype._generateStart = function(writeStream) {
	var methods = [];

	function _transformArray(array) {
		return array.map(function(argument) {
			if(typeof argument == 'string') {
				return '\'' + argument + '\'';
			}
			else if(util.isArray(argument)) {
				return '[' + _transformArray(argument) + ']';
			}
			else {
				return argument;
			}
		});
	}

	for(var i = 0, il = this._.length; i < il; i++) {
		var method = this._[i];

		// If the first and only argument is a constructor (a function with a name)
		// we transform it to two arguments: 1. the name, 2. an array with the argument names and the function itself.
		if(method.arguments.length == 1 && typeof method.arguments[0] == 'function' && method.arguments[0].name) {
			var transformedConstructor = this._transformConstructor(method.arguments[0]);
			methods.push({
				type: method.type,
				contents: '\'' + transformedConstructor.name + '\', [' + transformedConstructor.params + ']'
			});
		}
		else {
			methods.push({
				type: method.type,
				contents: _transformArray(method.arguments)
			});
		}
	}

	var moduleNames = (this.app.options.modules || []).map(function(moduleName) {
		return '\'' + moduleName + '\'';
	});

	return this._renderTo('init.js', {
		name: this.app.name,
		methods: methods,
		moduleNames: moduleNames
	}, writeStream);
};

Bridge.prototype._transformConstructor = function(constructor) {
	function _returnParamName(constructorName) {
		return function(paramName, index, array) {
			if(index == (array.length - 1)) {
				return paramName;
			}
			else {
				if(paramName == 'fire') {
					return '\'Fire' + constructorName + '\'';
				}
				else {
					return '\'' + paramName + '\'';
				}
			}
		};
	}

	var params = utils.getMethodArgumentNames(constructor);
	var constructorBody = utils.stripMethodFirstLine(constructor);
	params.push('function(' + params.join(', ') + ') ' + constructorBody);

	return {
		name: constructor.name,
		params: params.map(_returnParamName(constructor.name)).join(', ')
	};
};

Bridge.prototype._generateLocalControllers = function(writeStream) {
	var controllerNames = Object.keys(this.controllers);
	if(controllerNames.length > 0) {
		var controllers = [];

		for(var i = 0, il = controllerNames.length; i < il; i++) {
			var controllerName = controllerNames[i];
			var controllerConstructor = this.controllers[controllerName];

			controllers.push(this._transformConstructor(controllerConstructor));
		}

		return this._renderTo('controllers.js', {
			controllers: controllers
		}, writeStream);
	}

	return Q.when(false);
};

Bridge.prototype._generateModels = function(writeStream) {
	var modelNames = Object.keys(this.models);
	var models = [];

	if(modelNames.length > 0) {
		for(var i = 0, il = modelNames.length; i < il; i++) {
			var modelName = modelNames[i];
			var model = this.models[modelName];

			models.push({
				name: modelName,
				resource: inflection.pluralize(inflection.dasherize(modelNames[i])).toLowerCase(),
				isAuthenticator: model.isAuthenticator()
			});
		}
	}

	return this._renderTo('models.js', {models: models}, writeStream);
};

Bridge.prototype._getControllerRoutes = function(controller) {
	var routes = [];

	var router = new Router(controller);
	router.delegate = {
		addRoute: function(route) {
			route.transformedPath = route.path.replace(/(:([^/]+))/g, '\' + $$$2 + \'');
			route.transformedParams = '{' + route.argumentNames.map(function(argumentName) {
				return argumentName + ': ' + argumentName;
			}).join(', ') +'}';
			routes.push(route);
		}
	};
	router.createRoutes();

	return routes;
};

Bridge.prototype._generateFireControllers = function(writeStream) {
	var controllers = [];

	var controllerNames = Object.keys(this.controllers);
	if(controllerNames.length > 0) {
		for(var i = 0, il = controllerNames.length; i < il; i++) {
			var controllerName = controllerNames[i];
			var controller = this.controllers[controllerName];

			controllers.push({
				name: controller.name,
				routes: this._getControllerRoutes(controller)
			});
		}
	}

	return this._renderTo('fire.js', {controllers: controllers}, writeStream);
};

Bridge.prototype._closeWriteStream = function(writeStream) {
	writeStream.end();
};

Bridge.prototype.load = function() {
	// TODO: We should swizzle methods OR loop over the module items. Now we're doing a bit of both.
	debug('Bridge#load');

	var self = this;
	this.app.models.forEach(function(model) {
		self.addModel(model);
	});

	this.app.controllers.forEach(function(controllerConstructor) {
		self.addController(controllerConstructor);
	});
};

Bridge.prototype.generate = function(writeStream) {
	var self = this;
	return this._generateStart(writeStream)
		.then(function() {
			return self._generateLocalControllers(writeStream);
		})
		.then(function() {
			return self._generateModels(writeStream);
		})
		.then(function() {
			return self._generateFireControllers(writeStream);
		})
		.then(function() {
			return self._closeWriteStream(writeStream);
		})
		.catch(function(error) {
			throw error;
		});
};
