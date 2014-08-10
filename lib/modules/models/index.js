'use strict';

exports = module.exports = Models;

var Resources = require('./../../helpers/resources');

var inflection = require('inflection');
var util = require('util');
var path = require('path');
var debug = require('debug')('fire:models');
var Q = require('q');

var Datastore = require('./datastore');
var Model = require('./model');

function Models(app) {
	this.app = app;
	this.datastore = null;
	this.internals = {};
	this._loaded = false;
	this._authenticator = null;
	this._activeMigration = null;
}
util.inherits(Models, Resources);

// Should we expose a Model like this?
Models.prototype.Model = Model;

/**
* A model constructor defines a model with the name of the constructor. Please note that this constructor is invoked to set up a model, and not when a model instance is created.
*
* Every property set in the constructor will be considered a model property. The value should be an array of Models~PropertyType.
*
* It is not allowed to start a property name with _ or $ as these prefixes are currently reserved.
*
* An id property is automatically created, if it does not exist, with `[this.UUID, this.Update(false)]` property type, and is considered the model's primary key.
*
* For more information on all property types, see {@link PropertyTypes}.
*
* @callback ModelConstructor
*/

/**
* Sets up a model with a model constructor.
*
* Set any of the model constructor's prototype methods **after** invoking this method as this method inherits the constructor from Model thus overwriting the constructor's prototype.
*
* @throws {Error} A model name "Model" is currently reserved and this method will throw an error when trying to add Model.
*
* @example
*
* function User() {
* 	this.name = [this.String];
* }
* app.model(User);
*
* User.prototype.test = function() { ... };
*
* @param  {ModelConstructor} modelConstructor The named model constructor.
*/
Models.prototype.model = function(modelConstructor) {
	if(modelConstructor.name === 'Model') {
		throw new Error('The name "Model" is reserved unfortunately.');
	}

	util.inherits(modelConstructor, Model);
	this.addModelConstructor(modelConstructor);
};

Models.prototype.ignoreDisabled = true;

Models.prototype.getAuthenticator = function() {
	return this._authenticator;
};

Models.prototype.forEach = function(callback) {
	var self = this;
	Object.keys(this.internals).forEach(function(modelName) {
		var model = self.internals[modelName];
		callback(model, modelName);
	});
};

Models.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;

	this.forEach(function(model) {
		model.setActiveMigration(migration);
	});
};

Models.prototype.setup = function(basePath, modelsPath) {
	debug('Models::setup');

	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	var self = this;
	this.datastore = Datastore.factory(process.env.DATABASE_URL);
	return this.datastore.setup()
		.then(function() {
			// First we load all the model constructors.
			if(basePath) {
				Resources.prototype.setup.call(self, modelsPath || path.join(basePath, 'models'));
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
					debug('Setting authenticator.');

					self._authenticator = model;
				}
			}
		});
};

Models.prototype.addModelConstructor = function(modelConstructor, modelName_) {
	var modelName = modelName_ || modelConstructor.name;

	if(this._loaded) {
		var model = this._addModel(modelConstructor, modelName);
		model.getAllProperties();
	}
	else {
		this.internals[modelName] = modelConstructor;
		this[modelName] = modelName;
	}
};

Models.prototype._addModel = function(modelConstructor, modelName) {
	// TODO: or should we use (modelConstructor.super_ === Model)?
	if(!(modelConstructor.prototype instanceof Model)) {
		throw new Error('Model `' + (modelName || modelConstructor.name) + '` is not an instance of Model. Did you call fire.model(...) on your model?');
	}

	if(!modelName) {
		modelName = inflection.camelize(modelConstructor.name);
	}

	if(this[modelName] && this[modelName] != modelName) {
		throw new Error('Cannot create model `' + modelName + '` because it already exists.');
	}

	// TODO: find a better way to pass variables to models

	// TODO: Remove this. It should be avaiabile via Model.prototype.models instead.
	// In user-land, we're accessing models via this.models.XXX. This is a feature we'd like to keep.
	// So we need a way to pass the models property to the model.
	modelConstructor.prototype.models = this;

	var model = new modelConstructor();
	Model.call(model, modelName, this, this._workers, this._activeMigration);

	// At this point, the property types are not resolved yet.

	this[modelName] 			= model;
	this.internals[modelName] 	= model;

	this.datastore.addModel(modelName, model);

	return model;
};

Models.prototype.findModel = function(modelName) {
	return this[modelName];
};

Models.prototype.getModel = function(modelName) {
	var model = this.findModel(modelName);

	if(!model) {
		throw new Error('Could not find model `' + modelName + '` in models.');
	}

	return model;
};

Models.prototype.loadClass = function(modelConstructor) {
	if(!this.datastore) {
		throw new Error('Datastore is not initialized yet.');
	}
	else {
		if(typeof modelConstructor == 'function') {
			var modelName = inflection.camelize(modelConstructor.name);
			this.internals[modelName] = modelConstructor;

			// First set the name of the model, so we can use it in references already
			// After all models are loaded, we'll create them
			this[modelName] = modelName;
		}
		else {
			throw new Error('Trying to load invalid model class.');
		}
	}
};

Models.prototype.load = function(fullPath) {
	if(path.extname(fullPath) != '.js') {
		debug('Not loading model at path `' + fullPath + '` because the extension is not `.js`.');
	}
	else {
		debug('Models#load ' + fullPath);

		// We do not expect something to be set on `exports = module.exports = ...` anymore.
		// We just load the file—if there are models the get loaded via fire.model(...).
		var modelConstructor = require(fullPath);
		if(modelConstructor) {
			debug('WARNING: do not set a model on exports = module.exports.');
		}
	}
};

Models.prototype.destroyModel = function(modelName) {
	var model = this[modelName];

	if(!model) {
		throw new Error('Cannot destroy model `' + modelName + '` because it does not exist.');
	}

	// OK, let's just remove all associations
	model.removeAllAssociations();

	this[modelName] = null;

	if(this._activeMigration) {
		this._activeMigration.destroyModel(model);
	}
};

Models.prototype.createModel = function(modelName, properties) {
	var modelConstructor = function() {
		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			self[propertyName] = properties[propertyName];
		});
	};
	modelConstructor.name = modelName;

	util.inherits(modelConstructor, Model);

	// The below lines will be called as a result of fire.model().
	var model = this._addModel(modelConstructor, modelName);
	model.getAllProperties();

	if(this._activeMigration) {
		this._activeMigration.createModel(this[modelName]);
	}

	return model;
};

Models.prototype.execute = function(query, parameters) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, 'execute', Array.prototype.splice.call(arguments, 0));
	}

	return this.datastore.query(query, parameters);
};

Models.prototype.beginTransaction = function() {
	var self = this;
	return this.datastore.connect()
		.then(function(client) {
			self.datastore.currentTransaction = client;

			return client.query('BEGIN')
				.then(function() {
					return client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
				})
				.then(function() {
					return client;
				});
		});
};

Models.prototype.commitTransaction = function(transaction) {
	this.datastore.currentTransaction = null;
	return transaction.commit();
};

Models.prototype.rollbackTransaction = function(transaction) {
	this.datastore.currentTransaction = null;
	return transaction.rollback();
};
