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

	// TODO: We should only set a get thingy. Set should be disallowed.
	this.models = this._model.models;
	this.workers = this._model.workers;

	this.callHooks('beforeLoad');

	var properties = model.getAllProperties();

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		self.configureProperty(property);
	});

	this.callHooks('afterLoad');
}

/**
  * Adds property `property` to the model instance. This configures accessor methods of the property and any relationships. This is invoked when constructing the model instance right after `beforeLoad` hook and before `afterLoad` hook.
  * @param {Property} property The property to configure.
 **/
ModelInstance.prototype.configureProperty = function(property) {
	var propertyName = property.name;
	var self = this;

	if(property.isAssociation()) {
		if(property.isManyToMany()) {
			var singular = inflection.camelize(inflection.singularize(property.name));
			var plural = inflection.pluralize(singular);

			var associatedModel = property.getAssociatedModel();
			var associationName = property.options.through.getName();

			var methodsMap = {};
			methodsMap['get' + plural] = function(whereMap) {
				var fields = whereMap || {};
				fields[property.options.relationshipVia.name] = self;
				return associatedModel.find(fields, null);
			};

			methodsMap['find' + plural] = function() {
				// ...
			};

			methodsMap['add' + singular] = function(instanceOrDeferred) {
				// TODO: Basically everywhere we should be able to add deferreds
				return Q.when(instanceOrDeferred)
					.then(function(instance) {
						// TODO: Check if this is the correct instance type we're adding
						if(instance instanceof ModelInstance) {
							// So we want to create a new ...
							var fields = {};
							fields[inflection.camelize(property.model.getName(), true)] = self;
							fields[inflection.camelize(associatedModel.getName(), true)] = instance;

							return self.models[associationName].createOne(fields);
						}
						else {							
							throw new Error('Adding invalid model instance in `add' + singular + '`.');
						}
					});
			};

			methodsMap['remove' + singular] = function(instance) {
				// TODO: Check if this is the correct instance type we're removing
				if(instance instanceof ModelInstance) {
					var fields = {};
					fields[inflection.camelize(property.model.getName(), true)] = self;
					fields[inflection.camelize(associatedModel.getName(), true)] = instance;

					return self.models[associationName].remove(fields);
				}
				else {
					throw new Error('Removing invalid model instance in `remove' + singular + '`.');
				}
			};

			Object.keys(methodsMap).forEach(function(methodName) {
				self[methodName] = methodsMap[methodName];
			});
		}
		else {
			// TODO: Re-write this... this can be optimised...
			
			// TODO: Create set.. and remove.. methods
			var methodName = 'get' + inflection.camelize(property.name);

			// Create methods for all association types e.g. hasOne, belongsTo, etc
			if(property.options.hasMany) {
				var reference = property.getReference();
				self[methodName] = function() {
					var fields = {};
					fields[property.options.hasMany] = self;
					return reference.find(fields);
				};
			}
			else {
				var findKey = property.options.hasOne || property.options.belongsTo;
				
				self[methodName] = function() {
					var reference = property.getReference();

					var find = {};
					find[findKey] = self;
					return reference.findOne(find);
				};
			}
		}

		if(property.options.autoFetch) {
			// If auto fetch, we want to make a regular var available which returns a new model instance OR array
			Object.defineProperty(self, propertyName, {
				get: function() {
					if(property.options.hasMany) {						
						return self._references[propertyName] || [];
					}
					else {
						return self._references[propertyName];
					}
				},

				set: function(value) {
					self._changes[property.name] = value;
				}
			});
		}
	}

	if(!(property.isAssociation() && property.options.autoFetch)) {
		Object.defineProperty(self, propertyName, {
			get: function() {
				return self._changes[property.name] || self._map[property.columnName];
			},

			set: function(value) {
				// TODO: check if it's the same value?

				self._changes[property.name] = value;
			}
		});
	}
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

ModelInstance.prototype.addReference = function(property, modelInstance) {
	if(property.options.belongsTo) {
		this._references[property.name] = modelInstance;
	}
	else if(property.options.hasOne) {
		this._references[property.name] = modelInstance;
	}
	else if(property.options.hasMany) {
		if(!this._references[property.name]) {
			this._references[property.name] = [];
		}

		this._references[property.name].push(modelInstance);
	}
	else {
		throw new Error('Unknown association in -addReference.');
	}
};

ModelInstance.prototype.parseReferences = function(references) {
	var ret = false;

	var associations = this._model.getAssociations();

	//TODO: Maybe we should loop through references, like it used to, but in getters check if references exists etc?

	var self = this;
	Object.keys(references).forEach(function(name) {
		var association = associations[name];

		if(!references[name].id) {
			// TODO: Replace the .id bit with .getPrimaryKey()
		}
		else {
			ret = true;

			var modelInstance = new ModelInstance(association.getReference(), references[name], null)
			self.addReference(association, modelInstance);
		}
	});

	return ret;
};

ModelInstance.prototype.consumeRow = function(row) {
	// We only look for associations at this point
	// First, we check if we're still on the same id, if not, we reject this row

	// TODO: This doesn't really work properly as in some cases a result set contains more than 1 row
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

			// If we can't parse any of the reference, we consider this an unmatched row
			return this.parseReferences(references);
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

			// When we save a model with associations, it loses the instances ad we can't fetch them from memory again
			// So let's add them as references
			Object.keys(self._changes).forEach(function(propertyName) {
				var property = self._model.getProperty(propertyName);

				if(property && (property.isAssociation() && property.options.autoFetch)) {
					self.addReference(property, self._changes[propertyName]);
				}
			});

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

	var result = Q.when(true);

	var self = this;
	hookNames.forEach(function(hookName) {
		result = result.then(function() {
			if(self._model[hookName]) {
				return Q.when(self._model[hookName].call(self));
			}
			else {
				return Q.when(true);
			}
		});
	})

	return result;
};
