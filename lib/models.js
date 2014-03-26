'use strict';

exports = module.exports = Models;

var util = require('util');
var Resources = require('./resources');
var path = require('path');
var utils = require('./utils');
var inflection = require('inflection');
var Datastore = require('./datastore');
var Q = require('q');

function Models(workers) {
	this.datastore = null;
	this.internals = {};

	this._workers = workers;
}
util.inherits(Models, Resources);

Models.prototype.setup = function(path) {
	if(this.datastore) {
		throw new Error('Models#datastore already exists. Likely calling Models#setup for a second time. This is not allowed.');
	}

	this.datastore = Datastore.factory(process.env.DATABASE_URL);

	var Model = this.datastore.getModel();

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
}

Models.prototype._addModel = function(ModelClass, modelName, Model) {
	if(!modelName) {
		modelName = inflection.camelize(ModelClass.name);
	}

	if(!Model) {
		Model = this.datastore.getModel();
	}

	//todo: replace below with actual inheritance
	//todo: check if the user manually called inherits already
	//todo: check if modelClass is an actual class--and not something like {} (e.g. no class is exported)
	for(var method in Model.prototype) {
		ModelClass.prototype[method] = Model.prototype[method];
	}

	var model = new ModelClass(this);

	// Pass variables to the Model class
	Model.call(model, modelName, this, this._workers);

	if(this[modelName] && this[modelName] != modelName) {
		throw new Error('Duplicate model `' + modelName + '`.');
	}

	this[modelName] = model;
	this.internals[modelName] = model;

	this.datastore.addModel(modelName, model);

	return model;
};

Models.prototype.getModel = function(modelName) {
	var model = this[modelName];

	if(!model) {
		throw new Error('Could not find model `' + modelName + '` in models.');
	}

	return model;
}

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

Models.prototype.destroyModel = function(modelName, persist) {
	var ModelClass = this[modelName];
	this[modelName] = null;

	if(persist) {
		return ModelClass.destroy();
	}
	else {
		return true;
	}
};

Models.prototype.createModel = function(modelName, properties, persist) {
	var ModelClass = function(models) {
		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			self[propertyName] = properties[propertyName];
		});
	};

	this.addModel(ModelClass, modelName);

	if(persist) {
		return this[modelName].setup();
	}
	else {
		return true;
	}
};
