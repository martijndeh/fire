'use strict';

var mu = require('mu2');
var Q = require('q');
var path = require('path');
var inflection = require('inflection');
var stream = require('stream');
var utils = require('./../../helpers/utils');

exports = module.exports = API;

function modelMap(model) {
	var properties = [];
	var propertiesMap = model.getAllProperties();
	Object.keys(propertiesMap).forEach(function(propertyName) {
		var property = propertiesMap[propertyName];

		if(!property.options.isPrivate) {
			properties.push({
				name: property.name,
				capitalName: inflection.capitalize(property.name),
				hasMethod: !!property.options.hasMethod,
				hasMany: !!property.options.hasMany
			});
		}
	});

	return {
		name: model.getName(),
		authenticatingPropertyName: model.options.authenticatingProperty ? model.options.authenticatingProperty.name : null,
		isAuthenticator: model.isAuthenticator(),
		pluralName: inflection.pluralize(model.getName()),
		properties: properties
	};
}

/**
 * The API module.
 *
 * This module generates model controllers of all models during build phase and executes the controllers in the run phase. The model controllers get generated to /_api. To generate the model controllers:
 *
 * ```
 * $ fire generate api
 * ```
 *
 * @param {App} app The app.
 * @constructor
 */
function API(app) {
	this.app = app;
}

/**
 * Loads the model controllers in the run phase. This method is called when the app starts up. The model controllers are loaded in the `_api/` directory.
 *
 * @param  {String} basePath The root directory of the app.
 */
API.prototype.setup = function(basePath) {
	utils.readDir(path.join(basePath, '_api'), function(fullPath) {
		require(fullPath);
	});
};

API.prototype.ignoreDisabled = true;

/**
 * Writes the model controller of `model` to `writeStream`.
 *
 * Once this method finishes, it does close the `writeStream`.
 *
 * @param {Model} model       The model.
 * @param {fs.Writable} writeStream The write stream to write to.
 */
API.prototype.generateModelController = function(model, writeStream) {
	var defer = Q.defer();

	var readStream = mu.compileAndRender(path.join(__dirname, 'templates', 'model-controller-js.mu'), {
		fire: process.env.NODE_ENV === 'test' ? './..' : 'fire',
		model: modelMap(model),
		controllerName: model.getName() + 'ModelController',
		appName: this.app.name
	});
	readStream.pipe(writeStream);

	var errorCallback = function(error) {
		removeEventListeners();

		defer.reject(error);
	};
	var successCallback = function() {
		removeEventListeners();

		defer.resolve(false);
	};

	function removeEventListeners() {
		readStream.removeListener('end', successCallback);
		writeStream.removeListener('error', errorCallback);
		writeStream.removeListener('finish', successCallback);
	}

	writeStream.once('error', errorCallback);

	if(writeStream instanceof stream.Writable) {
		writeStream.once('finish', successCallback);
	}
	else {
		// The memory stream unfortunately does not emit the finish event. Instead, we'll listen when reading ends.
		readStream.once('end', successCallback);
	}

	return defer.promise;
};
