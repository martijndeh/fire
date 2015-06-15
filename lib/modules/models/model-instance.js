'use strict';

exports = module.exports = ModelInstance;

var inflection = require('inflection');
var Q = require('q');
var Model = require('./model');
var utils = require('./../../helpers/utils');

/**
 * A model instance represents one or multiple rows in the database. These instances are usually the return value(s) of Model#find, Model#create and Model#update methods.
 *
 * This calls the beforeLoad hook when initialization starts and calls afterLoad when initializations finishes. To declare a hook, declare a method with the hook name on the model's prototype. For example, this creates an afterCreate hook on a User model:
 *
 * ```js
 * function User() {
 * 	this.email = [this.String, this.Authenticate];
 * 	this.type = [this.String];
 * 	this.posts = [this.HasMany(this.models.Post)];
 * }
 * app.model(User);
 *
 * User.prototype.afterCreate = function() {
 * 	// Gets executed whenever a new model instance is created.
 * };
 * ```
 *
 * @param {Model} model   The model the instance belongs to.
 * @param {Dictionary} row     A map of all column-value pairs from the database.
 * @param {Dictionary} changes A map of property-value pairs set by the caller.
 * @param {String} id      The instance primary key's value, if known.
 * @param {String} hookname The name of the hook to execute after the model instance is created.
 * @param {Boolean} isPartial `true` if the model instance is partial. A partial model instance is returned from a create, update, delete or execute action.
 * @param {Boolean} isShallow If set to `true` the model instance does not dynamically create any methods. This is useful when you don't want to do anything with the model instances directly and don't need to overhead of creating dynamic methods.
 * @constructor
 */
function ModelInstance(model, row, changes, id, hookName, isPartial, isShallow, privateMap) {
	this._model = model;
	this._map	= null;
	this._id = id;
	this._isPartial = isPartial;
	this._isShallow = isShallow;
	this._privateMap = privateMap || {};

	if(row) {
		this.parseRow(row);
	}
	else {
		this._associations = {};
		this._associationsMaps = {};
	}

	this._changes = changes || {};

	// Shallow model instances might contain hooks, beforeLoad and afterLoad, which could reequire module properties. In the future, we can remove this
	model._moduleProperties.set(this);

	this.callHooks(['beforeLoad']);

	if(!isShallow) {
		// This adds any custom methods to the model instances, which are returned from e.g. Model#find calls.
		var methodName;
		for(methodName in this._model) {
			if(typeof Model.prototype[methodName] == 'undefined' && typeof this._model[methodName] == 'function') {
				this[methodName] = this._model[methodName];
			}
		}

		var properties = model.getAllProperties();

		var self = this;
		Object.keys(properties).forEach(function(propertyName) {
			var property = properties[propertyName];

			self.configureProperty(property);
		});
	}

	this.callHooks(['afterLoad']);

	if(hookName) {
		this.callHooks([hookName, 'afterSave']);
	}
}

/**
 * Convert the instance to a simple Dictionary when JSON#stringify is called.
 *
 * All auto-fetched assocations are included in the returned dictionary, see PropertyTypes#AutoFetch on how to configure associations to be auto-fetched.
 *
 * A _type key is also included. The _type's value is the name of the model. This is used in the client-side parser to allocate and initialize the correct model instance.
 *
 * Private properties, like a password, are not included in the returned dictionary, see PropertyTypes#Private on how to declare private properties.
 *
 * @return {Dictionary} The JSON representation of the model instance.
 */
ModelInstance.prototype.toJSON = function() {
	var toMap = function(object, model, propertyNames_, isPartial) {
		var json = {
			_type: model.getName()
		};

		if(isPartial && typeof object == 'string') {
			json.id = object;

			// This is an association in a partial model, e.g. after a create.
		}
		else {
			var properties = model.getAllProperties();
			var propertyNames = propertyNames_;

			if(!propertyNames) {
				propertyNames = Object.keys(properties);
			}

			propertyNames.forEach(function(propertyName) {
				var property = properties[propertyName];
				if(property.options.isPrivate) {
					// We're skipping private properties in JSON output.
				}
				else {
					if(property.isAssociation()) {
						var reference = object._associations[property.name];
						var associatedModel = property.getAssociatedModel();

						if(reference && (property.options.autoFetch || object._associations[property.name])) {
							if(Array.isArray(reference)) {
								json[property.name] = reference.map(function(modelInstance) {
									return toMap(modelInstance, associatedModel, property.options.autoFetchProperties, object._isPartial);
								});
							}
							else {
								json[property.name] = toMap(reference, associatedModel, property.options.autoFetchProperties, object._isPartial);
							}
						}
						else if(object._map[property.columnName]) {
							json[property.name] = toMap(object._map[property.columnName], associatedModel, property.options.autoFetchProperties, object._isPartial || typeof object._map[property.columnName] == 'string');
						}
						else if(!object._isPartial) {
							if(property.options.hasMany) {
								json[property.name] = [];
							}
							else {
								json[property.name] = null;
							}
						}
					}
					else {
						json[property.name] = object._map[property.columnName];
					}
				}
			});
		}

		return json;
	};

	return toMap(this, this._model);
};

/**
 * Clears all changes from the model. This erases any unsaved changed.
 */
ModelInstance.prototype.cancel = function() {
	this._changes = {};
};

/**
 * Validates a hashed property, see {@link PropertyTypes#Hash}.
 *
 * ```
 * return UserModel.getOne({email: 'martijn@ff00ff.nl'})
 * 	.then(function(instance) {
 *  	return instance.validateHash('password', 'my password');
 *  }).then(function(correct) {
 *  	if(correct) {
 *  		// Correct!
 *    	}
 *     	else {
 *  	   throw new Error('Incorrect password provided.');
 *      }
 *  });
 * ```
 *
 * This methods returns a promise which resolved to `true` if the password is correct. `false` if the password is incorrect.
 *
 * @param {String} hashedPropertyName The name of the property with a hash method.
 * @param {String} password The plaintext password.
 */
ModelInstance.prototype.validateHash = function(hashedPropertyName, password) {
	var passwordProperty = this._model.getProperty(hashedPropertyName);

	if(!passwordProperty) {
		throw new Error('Invalid property `' + hashedPropertyName + '`.');
	}

	var self = this;

	var map = {};

	var properties = this._model.getAllProperties();
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];
		map[propertyName] = self._map[property.columnName];
	});
	map.password = password;

	return Q.when(passwordProperty.options.hashMethod.call(this, map))
		.then(function(hashedPassword) {
			return (hashedPassword === self.password);
		});
};

/**
 * Either finds an existing login token if it's less than 1 week old. If no tokens can be found, or the tokens are older than a week, a new token is created.
 *
 * By default, tokens expire after two weeks.
 */
ModelInstance.prototype.getLoginToken = function() {
	if(!this._model.isAuthenticator()) {
		throw new Error('ModelInstance#getLoginToken is only available on the authenticator model.');
	}

	var expireDate = new Date();
	expireDate.setDate(expireDate.getDate() - 7);

	var self = this;
	var loginTokenModel = this._model.models[this._model.getName() + 'LoginToken'];
	return loginTokenModel.findOne({authenticator: this, createdAt: {$gt: expireDate}})
		.then(function(loginToken) {
			if(loginToken) {
				return loginToken;
			}
			else {
				return loginTokenModel.create({authenticator: self});
			}
		});
};

/**
 * Changes the instance's password. This method is only available on authenticator model instances.
 *
 * @param {String} currentPassword The current password
 * @param {String} newPassword     A new password
 * @param {String} confirmPassword Confirm password. Should be the same as `newPassword`.
 */
ModelInstance.prototype.changePassword = function(currentPassword, newPassword, confirmPassword) {
	if(!this._model.isPasswordBasedAuthenticator()) {
		throw new Error('ModelInstance#changePassword is only available on a password-based authenticator model.');
	}

	var self = this;
	return this.validateHash('password', currentPassword)
		.then(function(valid) {
	        if(valid) {
	            if(!newPassword.length) {
	                throw new Error('Invalid new password.');
	            }
				else if(newPassword != confirmPassword) {
					throw new Error('The passwords provided do not match.');
				}
	            else {
	                self.password = newPassword;
	                self.accessToken = null;

	                return self.save()
						.then(function() {
							if(self._model.onChangePassword) {
								var privateMap = self._privateMap;
								privateMap[self._model.options.authenticatingProperty.name] = self;
								privateMap.authenticator = self;

								return self._model.models.app.injector.call(self._model.onChangePassword, privateMap, self);
							}
						})
						.then(function() {
							return {};
						});
	            }
	        }
	        else {
	            throw new Error('The current password is invalid. Please try again.');
	        }
	    });
};

/**
  * Adds property `property` to the model instance. This configures accessor methods of the property and any relationships. This is invoked when constructing the model instance right after `beforeLoad` hook and before `afterLoad` hook.
  *
  * @param {Property} property The property to configure.
 **/
ModelInstance.prototype.configureProperty = function(property) {
	var propertyName = property.name;
	var self = this;

	if(property.isAssociation()) {
		var methodsMap = {};

		var singular = inflection.camelize(inflection.singularize(property.name));
		var plural = inflection.pluralize(singular);
		var associatedModel = property.getAssociatedModel();

		if(property.isManyToMany()) {
			var associationName = property.options.through.getName();

			// getProjects
			methodsMap['get' + plural] = function(whereMap, optionsMap) {
				var fields = whereMap || {};
				fields[property.options.relationshipVia.name + '.' + property.options.throughPropertyName] = self;
				return associatedModel.find(fields, optionsMap);
			};

			// findProject
			methodsMap['find' + singular] = function(whereMap, optionsMap) {
				var fields = whereMap || {};
				fields[property.options.relationshipVia.name + '.' + property.options.throughPropertyName] = self;

				return associatedModel.findOne(fields, optionsMap);
			};

			// getProject
			methodsMap['get' + singular] = function(whereMap, optionsMap) {
				return this['find' + singular](whereMap, optionsMap)
					.then(function(modelInstance) {
						if(modelInstance) {
							return modelInstance;
						}
						else {
							throw new Error('Not Found');
						}
					});
			};

			if(!property.options.throughPropertyName) {
				throw new Error('`throughPropertyName` is not set on property ' + self._model.getName() + '#' + property.name + '.');
			}

			if(!property.options.relationshipVia.options.throughPropertyName) {
				throw new Error('`throughPropertyName` is not set on property ' + self._model.getName() + '#' + property.options.relationshipVia.name + '.');
			}

			var createManyAssocationMethod = function(modelInstanceOrCreateMapOrUUID) {
				return Q.when(modelInstanceOrCreateMapOrUUID)
					.then(function(result) {
						if(result instanceof ModelInstance || typeof result == 'string') {
							return result;
						}
						else {
							return associatedModel.create(result);
						}
					})
					.then(function(modelInstanceOrUUID) {
						var fields = {};

						// The key names are correct now.
						fields[property.options.relationshipVia.options.throughPropertyName] = modelInstanceOrUUID;
						fields[property.options.throughPropertyName] = self;

						return self.models[associationName].create(fields)
							.then(function() {
								// TODO Add this association if it exists--not just when auto fetched
								if(property.options.autoFetch) {
									//self.addAssociation(property, modelInstance);

									// TODO: Also add this association to the other model instance...
								}

								return modelInstanceOrUUID;
							});
					});
			};

			// createProject
			methodsMap['create' + singular] = createManyAssocationMethod;

			// addProject
			methodsMap['add' + singular] = createManyAssocationMethod;

			// addProjects
			methodsMap['add' + plural] = function(modelInstancesOrCreateMaps) {
				var result = Q.when(true);
				modelInstancesOrCreateMaps.forEach(function(modelInstanceOrCreateMap) {
					result = result.then(function() {
						return self['add' + singular](modelInstanceOrCreateMap);
					});
				});
				return result;
			};

			// removeProject
			methodsMap['remove' + singular] = function(modelInstanceOrUUID, optionsMap) {
				var fields = {};

				fields[property.options.relationshipVia.options.throughPropertyName] = modelInstanceOrUUID;
				fields[property.options.throughPropertyName] = self;

				return self.models[associationName].remove(fields, optionsMap)
					.then(function(modelInstances) {
						if(modelInstances && modelInstances.length > 0) {
							return modelInstances[0];
						}
						else {
							return null;
						}
					});
			};

			// removeProjects
			methodsMap['remove' + plural] = function(modelInstancesOrUUIDs, optionsMap) {
				var result = Q.when(true);
				modelInstancesOrUUIDs.forEach(function(modelInstanceOrUUID) {
					result = result.then(function() {
						return self['remove' + singular](modelInstanceOrUUID, optionsMap);
					});
				});
				return result;
			};

			// removeAllProjects
			methodsMap['removeAll' + plural] = function() {
				var fields = {};
				fields[property.options.throughPropertyName] = self;

				return self.models[associationName].remove(fields);
			};
		}
		else if(property.options.hasMany) {
			// One-to-many associations

			methodsMap['get' + plural] = function(whereMap, optionsMap) {
				var where = whereMap || {};
				where[property.options.hasMany] = self;
				return associatedModel.find(where, optionsMap);
			};

			methodsMap['find' + singular] = function(whereMap, optionsMap) {
				var where = whereMap || {};
				where[property.options.hasMany] = self;
				return associatedModel.findOne(where, optionsMap);
			};

			methodsMap['get' + singular] = function(whereMap, optionsMap) {
				return this['find' + singular](whereMap, optionsMap)
					.then(function(modelInstance) {
						if(!modelInstance) {
							throw new Error('Not Found');
						}

						return modelInstance;
					});
			};

			methodsMap['add' + singular] = function(createMap, optionsMap) {
				var create = createMap || {};
				create[property.options.hasMany] = self;
				return associatedModel.create(createMap, optionsMap);
			};

			methodsMap['add' + plural] = function(createMaps, optionsMap) {
				var result = Q.when(true);
				createMaps.forEach(function(createMap) {
					result = result.then(function() {
						return self['add' + singular](createMap, optionsMap);
					});
				});
				return result;
			};

			methodsMap['remove' + singular] = function(whereMap, optionsMap) {
				var where = whereMap || {};
				where[property.options.hasMany] = self;
				return associatedModel.removeOne(whereMap, optionsMap);
			};
		}
		else if(property.options.belongsTo) {
			methodsMap['find' + singular] = function(whereMap, optionsMap) {
				// We have the id of the associated model already...
				var where = whereMap || {};
				where.id = self[propertyName];
				return associatedModel.findOne(where, optionsMap);
			};

			methodsMap['get' + singular] = function(whereMap, optionsMap) {
				return this['find' + singular](whereMap, optionsMap)
					.then(function(modelInstance) {
						if(!modelInstance) {
							throw new Error('Not Found');
						}

						return modelInstance;
					});
			};

			methodsMap['set' + singular] = function(modelInstance) {
				self[propertyName] = modelInstance;
				return self.save();
			};

			methodsMap['remove' + singular] = function() {
				self[propertyName] = null;
				return self.save();
			};
		}
		else if(property.options.hasOne) {
			methodsMap['find' + singular] = function(whereMap, optionsMap) {
				// We have the id of the associated model already...
				var where = whereMap || {};
				where[property.options.hasOne] = self;

				return associatedModel.findOne(where, optionsMap);
			};

			methodsMap['get' + singular] = function(whereMap, optionsMap) {
				return this['find' + singular](whereMap, optionsMap)
					.then(function(modelInstance) {
						if(!modelInstance) {
							throw new Error('Not Found');
						}

						return modelInstance;
					});
			};

			methodsMap['set' + singular] = function(modelInstance) {
				var setMap = {};
				var whereMap = {};

				if(!modelInstance) {
					whereMap[property.options.hasOne] = self;
					setMap[property.options.hasOne] = null;

					return associatedModel.updateOne(whereMap, setMap);
				}
				else {
					setMap[property.options.hasOne] = self;
					whereMap.id = modelInstance.id;

					return associatedModel.updateOne(whereMap, setMap);
				}
			};

			methodsMap['remove' + singular] = function() {
				return self['set' + singular](null);
			};
		}

		// TODO: Also make these properties available if there is no auto fetch e.g. the association is included in the fetch...
		if(property.options.autoFetch) {
			// If auto fetch, we want to make a regular var available which returns a new model instance OR array
			Object.defineProperty(self, propertyName, {
				get: function() {
					if(property.options.hasMany) {
						return self._associations[propertyName] || [];
					}
					else {
						return self._associations[propertyName] || self._changes[propertyName] || null;
					}
				},

				set: function(value) {
					self._changes[property.name] = value;

					// todo: should we add the value as association ModelInstance#addAssociation?
				}
			});
		}

		Object.keys(methodsMap).forEach(function(methodName) {
			self[methodName] = methodsMap[methodName].bind(self);
		});
	}

	if(!(property.isAssociation() && property.options.autoFetch)) {
		Object.defineProperty(self, propertyName, {
			get: function() {
				if(self._changes && typeof self._changes[property.name] != 'undefined') {
					return self._changes[property.name];
				}
				else if(self._associations[property.name]) {
					if(property.options.hasMany) {
						return self._associations[propertyName] || [];
					}
					else {
						return self._associations[propertyName] || self._changes[propertyName] || null;
					}
				}
				else if(self._map && typeof self._map[property.columnName] != 'undefined') {
					return self._map[property.columnName];
				}
				else if(self._map && typeof self._map[property.name] != 'undefined') {
					return self._map[property.name];
				}

				// We are not returning anything so the return value is undefined.
				// TODO: Change this to null instead.
			},
			set: function(value) {
				// TODO: check if it's the same value?

				self._changes[property.name] = value;
			}
		});
	}
};

/**
 * toQueryValue is executed by Table to convert a model instance to a valid parameter in a query.
 *
 * @return {String}
 */
ModelInstance.prototype.toQueryValue = function() {
	return this.id;
};

/**
 * @todo Replace this by PropertyTypes#Validate.
 *
 * Validates all set property values. This calls a validate method named after the property's name prefixed with validate. If the method returns a truthy value the property value is considered valid. If anything else the value is considered invalid.
 *
 * This method is invoked before saving the model in ModelInstance#save.
 *
 * @return {Promise}
 */
ModelInstance.prototype.validateChanges = function() {
	var result = Q.when(true);

	var self = this;
	Object.keys(this._changes).forEach(function(propertyName) {
		var propertyValue = self._changes[propertyName];

		var validateMethodName = 'validate' + inflection.camelize(propertyName);

		if(self._model[validateMethodName]) {
			result = result.then(function() {
				return Q.when(this._model[validateMethodName].call(self, propertyValue))
					.then(function(result) {
						if(!result) {
							var error = new Error('Cannot validate `' + propertyName + '`.');
							error.status = 400;
							throw error;
						}
						else if(result instanceof Error) {
							// We should just remove this. This is not a good practice.

							throw result;
						}
					});
			});
		}
	});

	return result;
};

ModelInstance.prototype.getAssociation = function(property, associationsMap) {
	if(property.options.belongsTo) {
		return this._associations[property.name];
	}
	else if(property.options.hasOne) {
		return this._associations[property.name];
	}
	else {
		if(associationsMap && associationsMap.id) {
			var associationId = associationsMap.id;

			if(this._associationsMaps[property.name] && this._associationsMaps[property.name][associationId]) {
				var associations = this._associations[property.name];
				for(var i = associations.length - 1; i >= 0; i--) {
					var association = associations[i];
					if(association._map.id == associationId) {
						return association;
					}
				}
			}
		}
	}

	return null;
};

/**
 * Adds modelInstance as association of property.
 *
 * @param {Property} property      The property of the association the model instance is added to.
 * @param {ModelInstance} modelInstance The model instance to be added to the association.
 */
ModelInstance.prototype.addAssociation = function(property, modelInstance) {
	if(property.options.belongsTo) {
		this._associations[property.name] = modelInstance;
	}
	else if(property.options.hasOne) {
		this._associations[property.name] = modelInstance;
	}
	else if(property.options.hasMany) {
		if(typeof this._associations[property.name] == 'undefined') {
			this._associations[property.name] = [];
		}

		if(typeof this._associationsMaps[property.name] == 'undefined') {
			this._associationsMaps[property.name] = {};
		}

		// If a model instance already exist, we do not want to add it again. TODO: What if the data schema wants duplicate entries?
		if(modelInstance._map.id && !this._associationsMaps[property.name][modelInstance._map.id] || !modelInstance._map.id) {
			if(modelInstance._map.id) {
				this._associationsMaps[property.name][modelInstance._map.id] = true;
			}

			this._associations[property.name].push(modelInstance);
		}
	}
	else {
		throw new Error('Unknown association in -addAssociation.');
	}
};

/**
 * Parses the associations dictionary and creates model instances for every association.
 *
 * Each value in the dictionary is a dictionary of column name-value pairs. An association only has one dictionary, because the associations are added per row. This method generally gets called multiple times per model instance (depending on the number of associations).
 *
 * @param {Dictionary} associations The dictionary with the association names as keys.
 * @return {Boolean} Returns true if a valid association is added, false otherwise.
 */
ModelInstance.prototype.createAssociations = function(associations) {
	var ret = false;

	var associationProperties = this._model.getAssociations();

	//TODO: Maybe we should loop through associations, like it used to, but in getters check if associations exists etc?

	var self = this;
	Object.keys(associations).forEach(function(name) {
		var association = associationProperties[name];

		if(!associations[name].id) {
			// TODO: Replace the .id bit with .getPrimaryKey()
		}
		else {
			ret = true;

			var existingModelInstance = self.getAssociation(association, associations[name]);
			if(existingModelInstance) {
				var parser = __parseRow(associations[name]);
				var associationsMap = parser[1];

				existingModelInstance.createAssociations(associationsMap);
			}
			else {
				var modelInstance = new ModelInstance(association.getAssociatedModel(), associations[name], null, null, null, self._isPartial, self._isShallow, self._privateMap);
				self.addAssociation(association, modelInstance);
			}
		}
	});

	return ret;
};

/**
 * @todo This method and ModelInstance#parseRow have similar code. They should be merged. It's not DRY.
 *
 * Reads the information of a datastore's row and parses the row if it's considerd part of this model instance.
 *
 * @param {Dictionary} row A row from the datastore.
 * @return {Boolean} Returns true if the row is consumed by this model instance, false if not.
 */
ModelInstance.prototype.consumeRow = function(row) {
	// We only look for associations at this point
	// First, we check if we're still on the same id, if not, we reject this row

	// TODO: This doesn't really work properly as in some cases a result set contains more than 1 row
	if(row.id && row.id == this._map.id) {
		var associationProperties = this._model.getAssociations();

		if(Object.keys(associationProperties).length > 0) {
			var parser = __parseRow(row);
			var associations = parser[1];

			// If we can't parse any of the reference, we consider this an unmatched row
			return this.createAssociations(associations);
		}
	}
	else {
		// TODO: Check if the everything is the same
	}

	return false;
};

/**
 * Parses the row and returns the associations and the column map parsed.
 *
 * @param {Dictionary} row A single row from the datastore.
 * @return {Array} Multiple return values in an array. At index 0 the columns found, and at index 1 the associations found. The array contains 2 items.
 */
function __parseRow(row) {
	var associations = {};
	var map = {};

	Object.keys(row || {}).forEach(function(columnName) {
		var associationName = utils.captureOne(columnName, /^([^\$]+)\$/);

		if(associationName) {
			var value = row[columnName];
			columnName = columnName.substring(associationName.length + '$'.length);

			if(!associations[associationName]) {
				associations[associationName] = {};
			}

			associations[associationName][columnName] = value;
		}
		else {
			map[columnName] = row[columnName];
		}
	});

	return [map, associations];
}

/**
 * Parses the given row and any associations it finds.
 *
 * @param {Dictionary} row Map of column name-value pairs.
 */
ModelInstance.prototype.parseRow = function(row) {
	var parser = __parseRow(row);
	var map = parser[0];
	var associations = parser[1];

	// Stores a column name-value for the model instance.
	this._map			= map;

	// Reset the associations. _associations stores all the model instances of all associations.
	this._associations	= {};
	this._associationsMaps = {};

	// Creates model instances for all found associations.
	this.createAssociations(associations);
};

/**
 * Resolves all promises set on the model instance.
 *
 * This makes it possible to set unresolved promises as values of properties. This method is called during saving. If any of the promises rejects, the saving of the model rejects, too.
 *
 * For example, consider creating a project instance with an owner property:
 *
 * ```js
 * this.models.Project.create({
 * 	name: 'Test Project',
 * 	owner: this.models.User.findOne({name: 'Martijn'})
 * });
 * ```
 */
ModelInstance.prototype.resolvePromises = function() {
	var self = this;

	var result = Q.when(true);

	// ... at this point, we might have promises in our _changes.
	// Let's make sure they're resolved first.
	Object.keys(self._changes || {}).forEach(function(key) {
		var promise = self._changes[key];

		// We check if it's a promise object. Please note: we do not currently allow promise-like objects via Q.isPromiseAlike.
		// Allowing promise-like objects could result in false-positives.
		if(Q.isPromise(promise)) {
			result = result.then(function() {
				var defer = Q.defer();

				promise.then(function(value) {
					// TODO: Perhaps we shouldn't set the value back but keep it as-is.
					self[key] = value;

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

/**
 * Internally checks all the values of the properties, applies any transform methods, if neccesary, and sets any default values, if specified.
 */
ModelInstance.prototype.checkProperties = function() {
	var self = this;
	return Q.when(this._model._transformSetMap(this._changes, !this._map))
		.then(function(map) {
			self._changes = map;
		});
};

/**
 * Removes the model instance.
 */
ModelInstance.prototype.remove = function() {
	return this._model.removeOne({id: this._id});
};

/**
 * Saves the model instance. This either creates a new model instance, or updates an existing model instance.
 *
 * ```
 * this.models.Post.create({
 * 		title: 'The Adventures of Huckleberry Finn',
 *   	createdAt: new Date()
 *  })
 *  .then(function(post) {
 *  	post.title = 'Confessions of a Shopaholic'
 *  	return post.save();
 * 	})
 * ```
 *
 * @return {Promise}
 */
ModelInstance.prototype.save = function() {
	//todo: check if we changed something
	//todo: check if id exists

	var self = this;

	// First check if the set properties are valid.
	return this.validateChanges()
		.then(function() {
			// If everything validated, call beforeCreate hook.
			if(!self._map) {
				return self.callHooks(['beforeCreate']);
			}
			else {
				return self.callHooks(['beforeUpdate']);
			}
		})
		.then(function() {
			// Resolve any promises we have in the changes.
			return self.resolvePromises();
		})
		.then(function() {
			// Some values are maybe transformables or special selects. Let's make sure they get parsed.
			return self.checkProperties();
		})
		.then(function() {
			// The check properties could set promises again, so let's resolve them now.
			return self.resolvePromises();
		})
		.then(function() {
			// ... we resolved all promises in the changes so we call beforeSave hook.
			return self.callHooks(['beforeSave']);
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
				// So let's add them as associations
				Object.keys(self._changes).forEach(function(propertyName) {
					var property = self._model.getProperty(propertyName);

					if(property && (property.isAssociation() && property.options.autoFetch)) {
						self.addAssociation(property, self._changes[propertyName]);
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
					result = self.callHooks(['afterUpdate', 'afterSave']);
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

/**
 * Warning: in the future the effects of these hooks might change. Currently the hooks are invoked on the same process, in the future, the hooks will be invoked in a worker process.
 *
 * Internally calls the hooks.
 *
 * The following hooks are supported:
 *
 * ##### beforeLoad
 * Before the model instance gets loaded. Please note: you cannot return a promise here to block the loading of the model.
 *
 * ##### afterLoad
 * After a model instance is loaded this hook is called. Please note: you cannot return a promise here to block the loading of the model.
 *
 * ##### beforeSave
 * Before the model is saved: either newly created or updated.
 *
 * ##### afterSave
 * invoked after the model instance successfully saved (either a new instance or updated instance).
 *
 * ##### afterCreate
 * invoked after a new instance is created.
 *
 * ##### afterUpdate
 * Invoked after a model instance is updated, either after ModelInstance#save or Model#update.
 *
 *
 *
 *
 * @param {Array} hookNames List of hook names to invoke the methods of.
 */
ModelInstance.prototype.callHooks = function(hookNames) {
	var self = this;
	var result = null;
	hookNames.forEach(function(hookName) {
		if(self._model[hookName]) {
			if(!result) {
				result = Q.when(self._model.models.app.injector.call(self._model[hookName], self._privateMap, self));
			}
			else {
				result = result.then(function() {
					return Q.when(self._model.models.app.injector.call(self._model[hookName], self._privateMap, self));
				});
			}
		}
	});

	return result;
};
