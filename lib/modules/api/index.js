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
				resource: inflection.transform(property.name, ['underscore', 'dasherize']).toLowerCase(),
				capitalName: inflection.capitalize(property.name),

				singularName: utils.ucfirst(inflection.singularize(property.name)),
				pluralName: utils.ucfirst(inflection.pluralize(property.name)),

				hasMethod: !!property.options.hasMethod,
				isManyToMany: property.isManyToMany(),
				isOneToMany: !property.isManyToMany() && !!property.options.hasMany,
				isOneToOne: !!property.options.belongsTo || !!property.options.hasOne,
				hasMany: !!property.options.hasMany
			});
		}
	});

	var authenticator = model.models.getAuthenticator();

	return {
		name: model.getName(),
		dependencyName: model.getName() + 'Model',
		authenticatorDependencyName: authenticator ? authenticator.getName() + 'Model' : null,
		authenticatingPropertyName: model.options.authenticatingProperty ? model.options.authenticatingProperty.name : null,
		isAuthenticator: model.isAuthenticator(),
		resourceName: inflection.transform(model.getName(), ['tableize', 'dasherize']).toLowerCase(),
		pluralName: inflection.pluralize(model.getName()),
		lowerCaseName: inflection.camelize(model.getName(), true),
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
 * @access private
 *
 * @param {App} app The app.
 * @constructor
 * @memberof API
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
	utils.requireDirSync(path.join(basePath, '_api'));
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

	if(model.disableAutomaticModelController) {
		console.log('Warning: not generating ' + model.getName() + ' because disableAutomaticModelController is set to true. Please update your Gruntfile.js to hide this warning.');

		defer.resolve(null);
	}
	else {
		var readStream = mu.compileAndRender(path.join(__dirname, 'templates', 'model-controller-js.mu'), {
			fire: process.env.NODE_ENV === 'test' ? './..' : 'fire',
			model: modelMap(model),
			controllerName: model.getName() + 'ModelController',
			appName: this.app.name
		});

		var errorCallback = function(error) {
			removeEventListeners();

			defer.reject(error);
		};
		var successCallback = function() {
			removeEventListeners();

			defer.resolve(false);
		};

		var removeEventListeners = function() {
			readStream.removeListener('end', successCallback);
			writeStream.removeListener('error', errorCallback);
			writeStream.removeListener('finish', successCallback);
		};

		writeStream.once('error', errorCallback);
		readStream.once('error', errorCallback);

		if(writeStream instanceof stream.Writable) {
			writeStream.once('finish', successCallback);
		}
		else {
			// The memory stream unfortunately does not emit the finish event. Instead, we'll listen when reading ends.
			readStream.once('end', successCallback);
		}

		readStream.pipe(writeStream);
	}

	return defer.promise;
};
