'use strict';

exports = module.exports = Models;

var utils = require('./../../helpers/utils');

var inflection = require('inflection');
var util = require('util');
var path = require('path');
var debug = require('debug')('fire:models');
var Q = require('q');

var Datastore = require('./datastore');
var Model = require('./model');

/**
 * The models module which is Node on Fire's ORM backed by PostgreSQL. It is designed to have a similar API on the front-end and the back-end. This allows you to do most things in the front-end, but move performance-critical and sensitive code to the back-end.
 *
 * Using the Models module you can define models. A model contains a list of properties and associations. One-to-one, one-to-many and many-to-many associations are supported.
 *
 * Models are persisted to the database. This happens in the release phase in the Migrations module. See {@link Migrations}.
 *
 * To create a model. For example, when creating a `User` model:
 * ```js
 * function User() {
 * 	this.name = [this.String];
 * }
 * app.model(User);
 * ```
 *
 * A `User` key is added to models instance so you can access the `User` model via:
 * ```
 * models.User.findOne();
 * ```
 *
 * In a model and controller instance, the models instance is always available as a property `models`. In a controller, for example:
 * ```
 * MyController.prototype.getUsers = function() {
 * 	return this.models.User.find({});
 * };
 * ```
 *
 * In the client-context, in a controller, you use the fire dependency:
 * ```
 * function MyController($scope, UserModel) {
 * 	UserModel.find()
 * 		.then(function(users) {
 *   		// Do something with `users`.
 *		})
 * }
 * app.controller(MyController);
 * ```
 *
 * @constructor
 */
function Models(app) {
	this.app = app;
	this.datastore = null;
	this.internals = {};
	this._loaded = false;
	this._authenticator = null;
	this._activeMigration = null;

	if(app) {
		var self = this;
		app.model = function(modelConstructor) {
			self.model(modelConstructor);
			return app;
		};
	}
}

// Should we expose a Model like this?
Models.prototype.Model = Model;
Models.prototype.enableModuleProperty = true;

/**
 * Stops the models module. This closes the connection pool to the database.
 */
Models.prototype.stop = function() {
	if(this.datastore) {
		return this.datastore.stop();
	}
	else {
		return Q.when(false);
	}
};

/**
* Sets up a model with a model constructor.
*
* A model constructor defines a model with the name of the constructor. Please note that this constructor is invoked to set up a model, and not when a model instance is created.
*
* Every property set in the constructor will be considered a model property. The value should be an array of Models~PropertyType.
*
* It is not allowed to start a property name with _ or $ as these prefixes are currently reserved.
*
* An id property is automatically created, if it does not exist, with `[this.UUID, this.CanUpdate(false)]` property type, and is considered the model's primary key.
*
* For more information on all property types, see {@link PropertyTypes}.
*
* Set any of the model constructor's prototype methods **after** invoking this method as this method inherits the constructor from Model thus overwriting the constructor's prototype.
*
* @throws {Error} A model name "Model" is currently reserved and this method will throw an error when trying to add Model.
*
* ```js
* function User() {
* 	this.name = [this.String];
* }
* app.model(User);
*
* User.prototype.test = function() { ... };
* ```
*
* @param  {Constructor} modelConstructor The named model constructor.
*/
Models.prototype.model = function(modelConstructor) {
	if(modelConstructor.name === 'Model') {
		throw new Error('The name "Model" is reserved unfortunately.');
	}

	util.inherits(modelConstructor, Model);
	this.addModelConstructor(modelConstructor);
};

Models.prototype.ignoreDisabled = true;

/**
 * Returns the authenticator model.
 *
 * The authenticator model is, for example, a User or Account model.
 *
 * To declare an authenticator model, set any of the model's properties to PropertyTypes#Authenticate.
 */
Models.prototype.getAuthenticator = function() {
	return this._authenticator;
};

/**
 * Convenience model to loop over all the models.
 *
 * @param {Function(model, modelName)} callback The callback function to invoke for every model.
 */
Models.prototype.forEach = function(callback) {
	var self = this;
	Object.keys(this.internals).forEach(function(modelName) {
		var model = self.internals[modelName];
		callback(model, modelName);
	});
};

/**
 * @todo Move this to Migrations.
 *
 * Sets the active migration on all models. This is used to proxy all calls on models during a migration to the migration.
 *
 * @param {Migration} migration The currently running migration.
 */
Models.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;

	this.forEach(function(model) {
		model.setActiveMigration(migration);
	});
};

/**
 * Sets up the datastore connection and loads all models from models/. The models are only loaded if basePath is provided.
 *
 * @param  {String} basePath   The app's base path.
 * @return {Promise}
 */
Models.prototype.setup = function(basePath) {
	debug('Models::setup');

	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	var self = this;
	this.datastore = Datastore.factory(process.env.DATABASE_URL);

	return this.datastore.setup()
		.then(function() {
			// In some cases `self.app` is not available.
			return (self.app && self.app.injector.register('knex', function() {
				return self.datastore.knex;
			}));
		})
		.then(function() {
			// First we load all the model constructors.
			if(basePath) {
				utils.requireDirSync(path.join(basePath, 'models'));
			}
		})
		.then(function() {
			var defer = Q.defer();
			setImmediate(defer.makeNodeResolver());
			return defer.promise;
		})
		.then(function() {
			self._loaded = true;

			// Then we converts all the constructors to model instances.
			var modelName;
			for(modelName in self.internals) {
				var modelConstructor = self.internals[modelName];

				self._addModel(modelConstructor, modelName);
			}

			// We configure all the properties and property types.
			// We do this in a second step as we first want all the models to be defined.
			for(modelName in self.internals) {
				var model = self.internals[modelName];
				model.getAllProperties();

				// Check options.
				if(model.isAuthenticator()) {
					self._authenticator = model;
				}
			}
		});
};

/**
 * Adds a model constructor.
 *
 * If the Models#setup has already been called, immediately loads the model for the given constructor.
 *
 * @param {Constructor} modelConstructor The model's constructor function.
 */
Models.prototype.addModelConstructor = function(modelConstructor) {
	var modelName = modelConstructor.name;

	this.app.injector.register(modelName + 'Model', function() {
		return modelName;
	});

	if(this._loaded) {
		var model = this._addModel(modelConstructor, modelName);
		model.getAllProperties();

		if(model.isAuthenticator()) {
			this._authenticator = model;
		}
	}
	else {
		this.internals[modelName] = modelConstructor;
		this[modelName] = modelName;
	}
};

/**
 * Allocates an object with the modelConstructor and inherits with the Model constructor. Sets the model on the models object so it's available as `this.models.ModelName` (where ModelName is the name of the model).
 *
 * @param {Constructor} modelConstructor The constructor of the model.
 * @param {String} modelName        The name of the model to add.
 * @return {Model}
 */
Models.prototype._addModel = function(modelConstructor, name, force) {
	if(modelConstructor.super_ !== Model) {
		util.inherits(modelConstructor, Model);
		//throw new Error('Model `' + (modelName || modelConstructor.name) + '` is not an instance of Model. Did you call fire.model(...) on your model?');
	}

	var modelName = name;
	if(!modelName) {
		modelName = inflection.camelize(modelConstructor.name);
	}

	if(this[modelName] && this[modelName] != modelName && !force) {
		throw new Error('Cannot create model `' + modelName + '` because it already exists.');
	}

	// In user-land, we're accessing models via this.models.XXX. This is a feature we'd like to keep.
	// So we need a way to pass the models property to the model.
	var moduleProperties = this.app.moduleProperties;
	moduleProperties.set(modelConstructor.prototype);

	var model = this._createModel(modelConstructor);

	Model.call(model, modelName, this, moduleProperties, this._activeMigration);

	this.app.injector.register(modelName + 'Model', function() {
		return model;
	});

	// At this point, the property types are not resolved yet.

	this[modelName] 			= model;
	this.internals[modelName] 	= model;

	this.datastore.addModel(modelName, model);

	return model;
};

Models.prototype._createModel = function(modelConstructor) {
	return this.app.injector.execute(modelConstructor, {});
};

/**
 * Returns Model with the name.
 *
 * @param {String} modelName The name of the model to return.
 */
Models.prototype.findModel = function(modelName) {
	return this[modelName];
};

/**
 * Returns the model. If the model does not exists, this method throws an error.
 *
 * @param {String} modelName The name of the model.
 */
Models.prototype.getModel = function(modelName) {
	var model = this.findModel(modelName);

	if(!model) {
		throw new Error('Could not find model `' + modelName + '` in models.');
	}

	return model;
};

/**
 * Stores the modelConstructor so that the model gets loaded when Model#setup is invoked.
 *
 * @param {Constructor} modelConstructor The model's constructor.
 */
Models.prototype.loadModelConstructor = function(modelConstructor) {
	if(!this.datastore) {
		throw new Error('Datastore is not initialized yet.');
	}

	if(typeof modelConstructor != 'function') {
		throw new Error('Trying to load invalid model constructor.');
	}

	var modelName = inflection.camelize(modelConstructor.name);
	this.internals[modelName] = modelConstructor;

	// First set the name of the model, so we can use it in references already
	// After all models are loaded, we'll create them
	this[modelName] = modelName;
};

/**
 * Destroys a model and removes all it's associations.
 *
 * This destroys the in-memory model and doens't actually drop the backing table or any model instances.
 *
 * @param {String} modelName The name of the model to destroy.
 */
Models.prototype.destroyModel = function(modelName) {
	var model = this[modelName];

	if(!model) {
		// The model is already destroyed or never existed.
	}
	else {
		// OK, let's just remove all associations
		model.removeAllAssociations();

		this[modelName] = null;

		if(this._activeMigration) {
			this._activeMigration.destroyModel(model);
		}
	}
};

/**
 * Creates a modelConstructor, and creates the associated model.
 *
 * This method is only invoked from migrations.
 *
 * @todo Move this to migrations.
 *
 * @param {String} modelName  The name of the model to create.
 * @param {Dictionary} properties All the properties in key-value pairs. Where value is an array of PropertyTypes items.
 */
Models.prototype.createModel = function(modelName, properties, force) {
	var modelConstructor = function() {
		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			self[propertyName] = properties[propertyName];
		});
	};

	util.inherits(modelConstructor, Model);

	// The below lines will be called as a result of fire.model().
	var model = this._addModel(modelConstructor, modelName, force);
	model.getAllProperties();

	if(this._activeMigration) {
		this._activeMigration.createModel(this[modelName]);
	}

	return model;
};

/**
 * Executes a raw query.
 *
 * @param  {String} query      The SQL statement to execute.
 * @param  {Array} parameters Any parameters to pass to the statement.
 * @return {Promise}            Resolves with a result set, see the pg module for more info.
 */
Models.prototype.execute = function(query, parameters) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, 'execute', Array.prototype.splice.call(arguments, 0));
	}

	return this.datastore.rawQuery(query, parameters);
};
