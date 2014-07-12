'use strict';

exports = module.exports = ModelInstance;

var inflection = require('inflection');
var Q = require('q');
var util = require('util');
var Model = require('./model');
var utils = require('./../../helpers/utils');

function ModelInstance(model, row, changes, id) {
	this._model = model;
	this._map	= null;
	this._id = id;

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

ModelInstance.prototype.toJSON = function() {
	var json = {};

	var properties = this._model.getAllProperties();
	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.options.isPrivate) {
			// We're skipping private properties in JSON output.
		}
		else {
			if(property.isAssociation() && property.options.autoFetch) {
				var reference = self._references[property.name];
				if(reference) {
					json[property.name] = reference;
				}
				else {
					if(property.options.hasMany) {
						json[property.name] = [];
					}
					else {
						json[property.name] = null;
					}
				}
			}
			else {
				json[property.name] = self._map[property.columnName];
			}
		}
	});

	return json;
};

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

			methodsMap['find' + singular] = function(instanceOrDeferred) {
				return Q.when(instanceOrDeferred)
					.then(function(instance) {
						if(instance instanceof ModelInstance) {
							var fields = {};
							fields[inflection.camelize(property.model.getName(), true)] = self;
							fields[inflection.camelize(associatedModel.getName(), true)] = instance;

							return self.models[associationName].findOne(fields);
						}
						else {
							throw new Error('Finding invalid model instance in `find' + singular + '`.');
						}
					});
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

							if(property.options.autoFetch) {
								self.addReference(property, instance);
							}

							return self.models[associationName].create(fields);
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
				self[methodName] = function() {
					var reference = property.getAssociatedModel();

					var fields = {};
					fields[property.options.hasMany] = self;
					return reference.find(fields);
				};
			}
			else {
				var findKey = property.options.hasOne || property.options.belongsTo;

				self[methodName] = function() {
					var reference = property.getAssociatedModel();

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
};

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

			var modelInstance = new ModelInstance(association.getAssociatedModel(), references[name], null);
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

ModelInstance.prototype._resolvePromises = function() {
	var self = this;

	var result = Q.when(true);

	// ... at this point, we might have promises in our _changes.
	// Let's make sure they're resolved first.
	Object.keys(self._changes).forEach(function(key) {
		var promise = self._changes[key];

		// We check if it's a promise object. Please note: we do not currently allow promise-like objects via Q.isPromiseAlike.
		// Allowing promise-like objects could result in false-positives.
		if(Q.isPromise(promise)) {
			result = result.then(function() {
				var defer = Q.defer();

				promise.then(function(value) {
					// TODO: Perhaps we shouldn't set the value back but keep it as-is.
					self._changes[key] = value;

					defer.resolve(value);
				});

				promise.catch(function(error) {
					defer.reject(error);
				});

				return defer.promise;
			});
		}
	});

	return result;
};

ModelInstance.prototype._checkProperties = function() {
	var properties = this._model.getAllProperties();

	var self = this;

	var isNew = (!self._map);

	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.isTransformable()) {
			// So, let's try to resolve the transformable if we have _all_ the values.
			var parameters = property.options.transformKeyNames.map(function(key) {
				return self._changes[key];
			});

			self._changes[property.name] = property.options.transformMethod.apply(self, parameters);
		}

		// If a change is set and the property type includes a hash, we'll hash it. Always.
		if(property.options.hashMethod && self._changes[property.name]) {
			self._changes[property.name] = property.options.hashMethod.call(self, self._changes[property.name]);
		}

		// Let's check if this is a new model creation. If it's just an update we don't want to set a default value.
		if(property.options.defaultValue && !self._changes[property.name] && isNew) {
			self._changes[property.name] = property.options.defaultValue.call(self);
		}

		/*
		if(property.isSelectable()) {
			var value = self._changes[property.name];
			if(typeof value != 'undefined') {
				var map = property.options.selectMethod.apply(self, [value]);
				Object.keys(map).forEach(function(key) {
					self._changes[key] = map[key];
				});
			}
		}
		*/
	});
};

ModelInstance.prototype.save = function() {
	//todo: check if we changed something
	//todo: check if id exists

	var self = this;

	// First check if the set properties are valid.
	return this._validateChanges()
		.then(function() {
			// If everything validated, call beforeCreate hook.
			if(!self._map) {
				return self.callHooks('beforeCreate');
			}
		})
		.then(function() {
			// Some values are maybe transformables or special selects. Let's make they get parsed.
			return self._checkProperties();
		})
		.then(function() {
			// Resolve any promises we have in the changes.
			return self._resolvePromises();
		})
		.then(function() {
			// ... we resolved all promises in the changes so we call beforeSave hook.
			return self.callHooks('beforeSave');
		})
		.then(function() {
			if(!self._map) {
				return self._model._create(self._changes);
			}
			else {
				if(self._id) {
					return self._model._updateOne({id: self._id}, self._changes);
				}
				else {
					return self._model._updateOne(self._map, self._changes);
				}
			}
		})
		.then(function(row) {
			if(!row) {
				// Update simply failed. The where clause was probably to restrictive.
				return null;
			}
			else {
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

				// Change select to the primary key of this instance.
				if(self._map.id) {
					self._id = self._map.id;
				}

				var result;
				if(isNew) {
					result = self.callHooks(['afterCreate', 'afterSave']);
				}
				else {
					result = self.callHooks('afterSave');
				}

				return Q.when(result)
					.then(function() {
						return self;
					});
			}
		})
		.catch(function(error) {
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
	});

	return result;
};
