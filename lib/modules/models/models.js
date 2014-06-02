exports = module.exports = Models;

var fire = require('./../../firestarter');
var Resources = require('./../../helpers/resources');
var utils = require('./../../helpers/utils');

var inflection = require('inflection');
var util = require('util');
var path = require('path');
var Q = require('q');

var Datastore = require('./datastore');
var Model = require('./model');

function Models(app) {
	this.app = app;
	this.datastore = null;
	this.internals = {};
	
	this._activeMigration = null;

	// TODO: Find a nice way to make every module accessible
	//this._workers = app.workers;
}
util.inherits(Models, Resources);

Models.prototype.forEach = function(callback) {
	var self = this;
	Object.keys(this.internals).forEach(function(modelName) {
		var model = self.internals[modelName];
		callback(model, modelName);
	});
}

Models.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;

	this.forEach(function(model) {
		model.setActiveMigration(migration);
	});
};

Models.prototype.setup = function(basePath) {
	if(!basePath) {
		throw new Error('Cannot set up models without a valid `basePath`.');
	}
	
	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	this.datastore = Datastore.factory(process.env.DATABASE_URL);

	// First we load all the model constructors.
	Resources.prototype.setup.call(this, path.join(basePath, 'models'));

	// Then we converts all the constructors to model instances.
	for(var modelName in this.internals) {
		var modelConstructor = this.internals[modelName];

		this._addModel(modelConstructor, modelName);
	}

	// We configure all the properties and property types.
	for(var modelName in this.internals) {
		var model = this.internals[modelName];

		model.getTable().addProperties(model.getAllProperties(), false);
	}
	
	return Q.when(true);
};

Models.prototype.addModel = function(modelConstructor, modelName) {
	var model = this._addModel(modelConstructor, modelName);
	model.getTable().addProperties(model.getAllProperties(), false);
	return model;
};

Models.prototype._addModel = function(modelConstructor, modelName) {
	if(!(modelConstructor.prototype instanceof Model)) {
		throw new Error('Model `' + (modelName || modelConstructor.name) + '` is not an instance of Model. Did you call fire.model(...) on your model?');
	}
	else {
		if(!modelName) {
			modelName = inflection.camelize(modelConstructor.name);
		}

		if(this[modelName] && this[modelName] != modelName) {
			throw new Error('Cannot create model `' + modelName + '` because it already exists.');
		}
		else {
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
		}
	}
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
	var modelConstructor = require(fullPath);
	if(modelConstructor) {
		this.loadClass(modelConstructor);
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

	this._activeMigration && this._activeMigration.destroyModel(model);
};

Models.prototype.createModel = function(modelName, properties) {
	var modelConstructor = function(models) {
		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			self[propertyName] = properties[propertyName];
		});
	};
	fire.model(modelConstructor);

	var model = this.addModel(modelConstructor, modelName);

	this._activeMigration && this._activeMigration.createModel(this[modelName]);

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
				})
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
