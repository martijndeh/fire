'use strict';

exports = module.exports = Models;

var util = require('util');
var Resources = require('./resources');
var path = require('path');
var utils = require('./utils');
var inflection = require('inflection');
var Datastore = require('./datastore');
var Q = require('q');
var Model = require('./model');

function Models(workers) {
	this.datastore = null;
	this.internals = {};
	this._activeMigration = null;

	this._workers = workers;
}
util.inherits(Models, Resources);

Models.prototype.forEach = function(callback) {
	var self = this;
	Object.keys(this.internals).forEach(function(modelName) {
		var model = self.internals[modelName];
		callback(model);
	});
}

Models.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;

	this.forEach(function(model) {
		model.setActiveMigration(migration);
	});
};

Models.prototype.setup = function(path) {
	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	this.datastore = Datastore.factory(process.env.DATABASE_URL);

	Resources.prototype.setup.call(this, path, Model);

	for(var modelName in this.internals) {
		var ModelClass = this.internals[modelName];

		this._addModel(ModelClass, modelName, Model);
	}

	for(var modelName in this.internals) {
		var model = this.internals[modelName];

		model.getTable().addProperties(model.getAllProperties(), false);
	}

	return Q.when(true);
};

Models.prototype.addModel = function(ModelClass, modelName, Model) {
	var model = this._addModel(ModelClass, modelName, Model);
	model.getTable().addProperties(model.getAllProperties(), false);
	return model;
};

Models.prototype._addModel = function(ModelClass, modelName) {
	if(!modelName) {
		modelName = inflection.camelize(ModelClass.name);
	}

	/*
	if(!Model) {
		Model = this.datastore.getModel();
	}
	*/

	//TODO: Replace below with actual inheritance
	//TODO: Check if the user manually called inherits already
	//TODO: Check if modelClass is an actual class--and not something like {} (e.g. no class is exported)
	// for(var method in Model.prototype) {
	// 	ModelClass.prototype[method] = Model.prototype[method];
	// }

	// TODO: find a better way to pass variables to models
	var model = new Model(modelName, this, this._workers, this._activeMigration);

	for(var methodName in ModelClass.prototype) {
		model[methodName] = ModelClass.prototype[methodName];
	}

	ModelClass.call(model, null);

	if(this[modelName] && this[modelName] != modelName) {
		throw new Error('Cannot create model `' + modelName + '` because it already exists.');
	}

	this[modelName] = model;
	this.internals[modelName] = model;

	this.datastore.addModel(modelName, model);

	return model;
};

Models.prototype.findModel = function(modelName) {
	return this[modelName];
}

Models.prototype.getModel = function(modelName) {
	var model = this.findModel(modelName);

	if(!model) {
		throw new Error('Could not find model `' + modelName + '` in models.');
	}

	return model;
};

Models.prototype.loadClass = function(ModelClass, Model) {
	if(!this.datastore) {
		throw new Error('Datastore is not initialized yet.');
	}
	else {
		if(typeof ModelClass == 'function') {
			var modelName = inflection.camelize(ModelClass.name);
			this.internals[modelName] = ModelClass;

			// First set the name of the model, so we can use it in references already
			// After all models are loaded, we'll create them
			this[modelName] = modelName;
		}
		else {
			throw new Error('Trying to load invalid model class.');
		}
	}
};

Models.prototype.load = function(fullPath, Model) {
	var ModelClass = require(fullPath);
	if(ModelClass) {
		this.loadClass(ModelClass, Model);
	}
};

Models.prototype.destroyModel = function(modelName) {
	var ModelClass = this[modelName];

	if(!ModelClass) {
		throw new Error('Cannot destroy model `' + modelName + '` because it does not exist.');
	}

	// OK, let's just remove all associations
	ModelClass.removeAllAssociations();

	this[modelName] = null;

	this._activeMigration && this._activeMigration.destroyModel(ModelClass);
};

Models.prototype.createModel = function(modelName, properties) {
	var ModelClass = function(models) {
		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			self[propertyName] = properties[propertyName];
		});
	};

	var model = this.addModel(ModelClass, modelName);

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
