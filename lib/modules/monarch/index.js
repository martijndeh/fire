'use strict';

exports = module.exports = Monarch;

var Q = require('q');

var utils = require('./../../helpers/utils');
var inflection = require('inflection');
var mu = require('mu2');

var path = require('path');

function Monarch(app) {
	this.app 			= app;
	this.controllers 	= {};
	this.models 		= {};
}

Monarch.prototype.addController = function(controllerConstructor) {
	this.controllers[controllerConstructor.name] = controllerConstructor;
};

Monarch.prototype.addModel = function(modelConstructor) {
	this.models[modelConstructor.name] = modelConstructor;
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

Monarch.prototype._closeWriteStream = function(writeStream) {
	writeStream.end();
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
			return self._closeWriteStream(writeStream);
		})
		.fail(function(error) {
			throw error;
		});
};
