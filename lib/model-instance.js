'use strict';

exports = module.exports = ModelInstance;

var inflection = require('inflection');
var Q = require('q');
var util = require('util');
var Model = require('./model');
var utils = require('./utils');

function ModelInstance(model, row, changes) {
	this._model = model;
	this._map	= null;

	if(row) {
		this.parseRow(row);
	}

	this._changes = changes || {};

	// TODO: replace with actual inheritance
	// TODO: we should loop over the prototype only...
	for(var methodName in this._model) {
		if(!Model.prototype[methodName] && typeof this._model[methodName] == 'function') {
			this[methodName] = this._model[methodName];
		}
	}

	this.models = this._model.models;
	this.workers = this._model.workers;

	this.callHooks('beforeLoad');

	var properties = model.getAllProperties();

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.isAssociation()) {
			// Let's create a method to retrieve models...
			if(property.manyAssociation) {
				var methodName = 'get' + inflection.camelize(property.name);
				
				self[methodName] = function() {
					var reference = property.getReference(); //this is Project

					var find = {};
					find[property.manyAssociation] = self.id;
					return reference.find(find);
				};
			}
		}

		// Let's check autoFetch, reference, etc
		if(property.isAssociation() && property.autoFetch) {
			// If auto fetch, we want to make a regular var available which returns a new model instance OR array
			Object.defineProperty(self, propertyName, {
				get: function() {
					return self._references[propertyName];
				},

				set: function(value) {
					self._changes[property.columnName] = value;
				}
			});
		}
		else {
			Object.defineProperty(self, propertyName, {
				get: function() {
					return self._changes[property.columnName] || self._map[property.columnName];
				},

				set: function(value) {
					// TODO: check if it's the same value?

					self._changes[property.columnName] = value;
				}
			});
		}
	});

	this.callHooks('afterLoad');
}

ModelInstance.prototype.toQueryValue = function() {
	return this.id;
};

ModelInstance.prototype._validateChanges = function() {
	/*
	var result = Q(true);

	Object.keys(this._changes).forEach(function(propertyName) {
		result = result.then(function() {

		})
	})

	return result;
	*/

	//var validators = [];
	for(var propertyName in this._changes) {
		var propertyValue = this._changes[propertyName];

		var validateMethodName = 'validate' + inflection.camelize(propertyName);

		if(this._model[validateMethodName]) {
			var result = this._model[validateMethodName].call(this, propertyValue);

			if(!result) {
				var error = new Error('Cannot validate ' + propertyName + '.');
				error.status = 400;
				throw error;
			}
			else if(result instanceof Error) {
				throw result;
			}
		}
	}

	return Q.when(true);
};

ModelInstance.prototype.parseReferences = function(references) {
	var associations = this._model.getAssociations();

	var self = this;
	Object.keys(references).forEach(function(name) {
		var association = associations[name];

		if(association.oneAssociation) {
			self._references[name] = new ModelInstance(association.getReference(), references[name], null);
		}
		else if(association.manyAssociation) {
			if(!self._references[name]) {
				self._references[name] = [];
			}
			self._references[name].push(new ModelInstance(association.getReference(), references[name], null));
		}
	});
};

ModelInstance.prototype.consumeRow = function(row) {
	// We only look for associations at this point
	// First, we check if we're still on the same id, if not, we reject this row
	if(row.id == this._map.id) {
		var associations = this._model.getAssociations();

		if(Object.keys(associations).length > 0) {
			var references = {};

			var self = this;
			Object.keys(row || {}).forEach(function(columnName) {
				var referenceName = utils.captureOne(columnName, /^_nof_(.*?)_nof_/);

				if(referenceName) {
					var value = row[columnName];
					columnName = columnName.substring(referenceName.length + '_nof_'.length * 2);

					if(!references[referenceName]) {
						references[referenceName] = {};
					}

					references[referenceName][columnName] = value;
				}
			});

			this.parseReferences(references);
			return true;
		}
	}

	return false;
};

ModelInstance.prototype.parseRow = function(row) {
	// So, it's a bit of a hack, but we're returning columns in a join via $(.*?)$
	// we can just look for $ and $, get the substring, find the autoFetch, store the values, bla bla bla
	//var autoFetchMap = this._model.getAutoFetch();
	//var manyAssociationMap = this._model.getManyAssociation();

	var map = {};
	var references = {};

	var self = this;
	Object.keys(row || {}).forEach(function(columnName) {
		var referenceName = utils.captureOne(columnName, /^_nof_(.*?)_nof_/);

		if(referenceName) {
			var value = row[columnName];
			columnName = columnName.substring(referenceName.length + '_nof_'.length * 2);

			if(!references[referenceName]) {
				references[referenceName] = {};
			}

			references[referenceName][columnName] = value;
		}
		else {
			map[columnName] = row[columnName];
		}
	});

	this._map			= map;
	this._references	= {};

	this.parseReferences(references);
};

ModelInstance.prototype.save = function() {
	//todo: check if we changed something
	//todo: check if id exists

	var self = this;
	return this._validateChanges()
		.then(function() {
			if(!self._map) {
				return self.callHooks(['beforeCreate', 'beforeSave']);
			}
			else {
				return self.callHooks('beforeSave');
			}
		})
		.then(function() {
			if(!self._map) {
				return self._model._create(self._changes);
			}
			else {
				return self._model._updateOne({id: self._map.id}, self._changes);
			}
		})
		.then(function(row) {
			var isNew = (!self._map);

			self.parseRow(row);

			self._changes	= {};

			if(isNew) {
				return self.callHooks(['afterCreate', 'afterSave']);
			}
			else {
				return self.callHooks('afterSave');
			}
		})
		.then(function() {
			return self;
		})
		.fail(function(error) {
			throw error;
		});
};

ModelInstance.prototype.callHooks = function(hookNames) {
	if(!util.isArray(hookNames)) {
		hookNames = [hookNames];
	}

	return hookNames.reduce(function(soFar, hookName) {
		return soFar.then(function() {
			if(this._model[hookName]) {
				return Q.when(this._model[hookName].call(this));
			}
			else {
				return Q.when();
			}
		}.bind(this));
	}.bind(this), Q.when(true));
};
