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
	
	this._activeMigration = null;
}
util.inherits(Models, Resources);

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

Models.prototype.setup = function(basePath) {
	var defer = Q.defer();

	debug('Models::setup');

	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	this.datastore = Datastore.factory(process.env.DATABASE_URL);

	// First we load all the model constructors.
	if(basePath) {
		Resources.prototype.setup.call(this, path.join(basePath, 'models'));
	}

	// We are delaying the other executions as we need to wait before the models prototype is fully declared.
	// Because, in user-land, to define a model, one must use fire.model(...) right after the constructor,
	// which means the rest isn't set yet.
	var self = this;
	setImmediate(function() {
		self._loaded = true;

		// Then we converts all the constructors to model instances.
		for(var modelName in self.internals) {
			var modelConstructor = self.internals[modelName];

			console.log('loop going to ' + modelName);
			self._addModel(modelConstructor, modelName);
		}

		// We configure all the properties and property types.
		for(var modelName in self.internals) {
			var model = self.internals[modelName];

			model.getTable().addProperties(model.getAllProperties(), false);
		}

		debug('~Models::setup');
		defer.resolve();
	});
	
	return defer.promise;
};

Models.prototype.addModelConstructor = function(modelConstructor, modelName_) {
	var modelName = modelName_ || modelConstructor.name;

	if(this._loaded) {
		console.log('really loading model ' + modelName);

		var model = this._addModel(modelConstructor, modelName);
		model.getTable().addProperties(model.getAllProperties(), false);
	}
	else {
		console.log('queueing model ' + modelName);

		this.internals[modelName] = modelConstructor;
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

	// In user-land, we're accessing models via this.models.XXX. This is a feature we'd like to keep.
	// So we need a way to pass the models property to the model.
	modelConstructor.prototype.models = this;

	var model = new modelConstructor();
	Model.call(model, modelName, this, this._workers, this._activeMigration);

	// TODO: Check any of the options on the model.
	
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
	// We do not expect something to be set on `exports = module.exports = ...` anymore.
	// We just load the file—if there are models the get loaded via fire.model(...).
	var modelConstructor = require(fullPath);
	if(modelConstructor) {
		debug('WARNING: do not set a model on exports = module.exports.');
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
	util.inherits(modelConstructor, Model);

	// The below lines will be called as a result of fire.model().
	var model = this._addModel(modelConstructor, modelName);
	model.getTable().addProperties(model.getAllProperties(), false);

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
