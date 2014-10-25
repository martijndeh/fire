exports = module.exports = Model;

var util = require('util');
var utils = require('./../../helpers/utils');
var ModelInstance = require('./model-instance');
var Property = require('./property');
var AccessControl = require('./access-control');
var Q = require('q');
var inflection = require('inflection');

/**
 * Do not construct a `Model` instance yourself, instead, you can construct a model via {@link App#model}.
 *
 * The model is a collection of properties and associations. Through a model you can find, update, create and delete model instances.
 *
 * @param {String} name The name of the model.
 * @param {Models} models The model collection instance.
 * @param {Migration} activeMigration The active migration, if any.
 *
 * @constructor
 */
function Model(name, models, moduleProperties, activeMigration) {
	this._name = name;
	this.models = models;
	this.options = {};
	this._properties = null;
	this._table = null;
	this._accessControl = new AccessControl();
	this._associations = {};

	this._activeMigration = activeMigration;

	if(moduleProperties) {
		moduleProperties.set(this);
		this._moduleProperties = moduleProperties;
	}
}

/**
 * Dasherizes the model's name as the naming convention of the file name (without the extension).
 *
 * @returns {String}
 */
Model.prototype.getFileName = function() {
	return inflection.transform(this._name, ['tableize', 'dasherize', 'singularize']);
};

/**
 * Returns true if this model is the authenticator. The authenticator is, for example, the User model. This is defined by setting the {@link PropertyTypes#Authenticate} property type.
 *
 * If you need to get the authenticator model, use {@link Models#getAuthenticator}.
 *
 * @returns {Boolean}
 */
Model.prototype.isAuthenticator = function() {
	return (!!this.options.authenticatingProperty);
};

/**
 * Sets the active migration. When an active migration is set, all calls are proxied to the migration instead.
 *
 * @param {Migration} migration The currently running migration.
 */
Model.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;
};

/**
 * Returns all the property names-property pairs which are part of an association.
 *
 * @returns {Dictionary}
 */
Model.prototype.getAllAssociations = function() {
	return this.getAssociations();
};

/**
 * Synonym of {@link Model#getAllAssociations}.
 */
Model.prototype.getAssociations = function() {
	return this._associations;
};

/**
 * Returns a property which is an association.
 *
 * @param {String} associationName The name of the property
 * @returns {Property}
 */
Model.prototype.getAssociation = function(associationName) {
	return this._associations[associationName];
};

/**
 * Removes all properties which are part of an association.
 *
 * This method is invoked when a model gets destroyed during a migration.
 */
Model.prototype.removeAllAssociations = function() {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		self.removeProperty(self._associations[associationName]);
	});
};

/**
 * Returns all properties which are associations to @model. Optionally only the association properties which name matches linkedPropertyName.
 *
 * @access private
 *
 * @param {Model} model              The model.
 * @param {String=} linkedPropertyName [description]
 * @returns {Property[]}
 */
Model.prototype.findAssociationsTo = function(model, linkedPropertyName) {
	var associations = [];

	var self = this;
	Object.keys(this._associations).forEach(function(name) {
		var association = self._associations[name];

		if(association.getAssociatedModel() == model || association.options.referenceName == model.getName()) {
			if(!linkedPropertyName || linkedPropertyName == name) {
				associations.push(association);
			}
		}
	});

	return associations;
};

/**
 * Sets the table of the model.
 *
 * @access private
 *
 * @param {Table} table
 */
Model.prototype.setTable = function(table) {
	this._table = table;
};

/**
 * Returns the table.
 *
 * @throws {Error} If table is not set.
 * @returns {Table}
 */
Model.prototype.getTable = function() {
	if(!this._table) {
		throw new Error('No table exists for model `' + this.getName() + '`.');
	}

	return this._table;
};

/**
 * Returns the name of the model.
 *
 * @returns {String}
 */
Model.prototype.getName = function() {
	return this._name;
};

/**
 * Adds a property to the model.
 *
 * If a migration is running, passes the property to the migration.
 *
 * If the property is an association, stores the association internally.
 *
 * @access private
 *
 * @param {Property}  property The property to add.
 * @param {Boolean} isNew    True if the property is newly added to the model, otherwise false.
 * @returns {Property}
 */
Model.prototype.addProperty = function(property, isNew) {
	if(!property.name || property.name[0] == '_' || property.name[0] == '$') {
		throw new Error('Invalid property name `' + property.name + '`. Property names may not start with _ or $ as they are reserved.');
	}

	if(!isNew && this._activeMigration) {
		this._activeMigration.addProperty(property, this._properties[property.name]);
	}

	this._properties[property.name] = property;

	if(property.isAssociation()) {
		this._associations[property.name] = property;
	}

	return property;
};

/**
 * Creates a new property and returns it.
 *
 * If no property types are supplied this method returns null.
 *
 * @access private
 *
 * @param {String}  propertyName  The name of the new property.
 * @param {PropertyType[]}  propertyTypes The property types of the new property.
 * @param {Boolean} isNew         True if the property is newly added to the model, otherwise false.
 * @returns {Property}
 */
Model.prototype._addProperty = function(propertyName, propertyTypes, isNew) {
	if(propertyTypes && propertyTypes.length > 0) {
		return this.addProperty(new Property(propertyName, propertyTypes, this, this.models), isNew);
	}
	return null;
};

/**
 * Removes the property part of a many association to model.
 *
 * @access private
 *
 * @param {Model} model
 */
Model.prototype._removeManyAssociationTo = function(model) {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		var association = self._associations[associationName];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		if(association.manyAssociation && association.getAssociatedModel() == model) {
			self.removeProperty(association);
		}
	});
};

/**
 * Removes the property part of a one association to model.
 *
 * @access private
 *
 * @param {Model} model
 */
Model.prototype._removeOneAssociationTo = function(model) {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		var association = self._associations[associationName];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		if(association.oneAssociation && association.getAssociatedModel() == model) {
			self.removeProperty(association);
		}
	});
};

/**
 * Removes a property from this model with the name of `property`. If the property to be removed is part of an association, also removes the association from the model and removes the property to this model from the associated model.
 *
 * If an active migration is set, sends the removal to the migration.
 *
 * @access private
 *
 * @param {Property} property The property to remove.
 */
Model.prototype.removeProperty = function(property) {
	if(this._activeMigration) {
		this._activeMigration.removeProperty(property);
	}

	delete this._properties[property.name];

	if(property.isAssociation()) {
		delete this._associations[property.name];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		// If this is a Many association, we might want to remove the original property
		if(property.manyAssociation) {
			property.getAssociatedModel()._removeOneAssociationTo(this);
		}
		else if(property.oneAssociation) {
			// TODO: this isn't really safe... there could be more associations really
			property.getAssociatedModel()._removeManyAssociationTo(this);
		}
	}
};

/**
 * Finds a property with a given key path. A key path is a string referring to a property or a property of any association.
 *
 * For example, given an Article model with an author association to the User model. The following key path would refer to the author's name: "author.name".
 *
 * @param {String} keyPath
 */
Model.prototype.getProperty = function(keyPath) {
	if(!keyPath) {
		throw new Error('Cannot find property with key path `null` (or `undefined`)');
	}

	var property = this._properties[keyPath];

	if(!property) {
		var propertyNames = keyPath.split('.', 2);
		if(propertyNames.length > 1) {
			var firstProperty = this._properties[propertyNames[0]];
			var associatedModel;

			if(firstProperty.isManyToMany()) {
				associatedModel = firstProperty.options.through;
			}
			else {
				associatedModel = firstProperty.getAssociatedModel();
			}

			property = associatedModel.getProperty(propertyNames[1]);
		}
	}

	return property;
};

/**
 * Returns all properties in a string-property dictionary.
 *
 * If the properties are not initialised yet, this internally creates the properties. In this phase the default `id` property is also created.
 *
 * @returns {Dictionary.<String, Property>}
 */
Model.prototype.getAllProperties = function() {
	if(!this._properties) {
		this._properties = {};

		// Now we create the default properties, currently only Id
		// There is a catch here: if it's already set by the user, we don't do anything
		// Even if it's set to something like [] (which gets ignored)
		if(!this.id) {
			this.id				= [this.UUID, this.CanUpdate(false)];
			this._properties.id = new Property('id', [this.UUID, this.CanUpdate(false)], this, this.models);
		}

		var propertyName;
		for(propertyName in this) {
			var propertyTypes = this[propertyName];
			if(util.isArray(propertyTypes) && !Model.prototype[propertyName]) {
				this._addProperty(propertyName, propertyTypes, true);
			}
		}
	}

	return this._properties;
};

/**
 * Changes properties. Only called from migrations. During a migration, this alters columns in a table.
 *
 * @access private
 *
 * @param {Dictionary.<String, PropertyType[]>} properties
 */
Model.prototype.changeProperties = function(properties) {
	return this.addProperties(properties);
};

/**
 * Adds properties to the model and returns the added properties.
 *
 * If a property already exists, the property is overwritten.
 *
 * @access private
 *
 * @param {Dictionary.<String, PropertyType[]>}  properties
 * @param {Boolean} isNew      True if this is a new model, false if otherwise.
 */
Model.prototype.addProperties = function(properties, isNew) {
	var addedProperties = {};

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self[propertyName] = properties[propertyName];

		var property = self._addProperty(propertyName, properties[propertyName], isNew);
		if(property) {
			addedProperties[property.name] = property;
		}
	});

	// Should we return this?
	return addedProperties;
};

/**
 * Edits a model's properties, adding, removing or altering properties.
 *
 * If an active migration is running, this edit is added as a task to the migration.
 *
 * @access private
 *
 * @param  {Property[]} addedProperties   [description]
 * @param  {Property[]} removedProperties [description]
 * @param  {Property[]} changedProperties [description]
 * @return {Mixed}                   A database result set. See {@link Datastore#query}.
 */
Model.prototype.edit = function(addedProperties, removedProperties, changedProperties) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}

		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.alter(addedProperties, removedProperties, changedProperties);
};

/**
 * Removes properties from the model.
 *
 * @access private
 *
 * @param {String[]} propertyNames The names of the properties to remove.
 */
Model.prototype.removeProperties = function(propertyNames) {
	var self = this;
	propertyNames.forEach(function(propertyName) {
		delete self[propertyName];

		var property = self._properties[propertyName];

		self.removeProperty(property);
	});
};

/**
 * Sets up the model's table. This creates the table and is usually called from migrations.
 *
 * If an active migration is running, this is added as a task to the migration.
 *
 * @return {Mixed} The database result. See {@link Datastore#query}.
 */
Model.prototype.setup = function() {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.create();
};

/**
 * Creates a new model instance with the values from `setMap`.
 *
 * @access private
 *
 * @param  {Dictionary.<String, Mixed>} setMap - The values to set on the new model instance.
 * @return {Dictionary} The result from the databas.
 */
Model.prototype._create = function(setMap) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.insert(setMap)
		.then(function(result) {
			return result.rows[0];
		});
};

/**
 * Updates model instances.
 *
 *
 *
 * @param  {Dictionary|String} whereMap
 * @param  {Dictionary} setMap
 * @param  {Dictionary} optionsMap Additional options to provide, similar to {@link Model#find}.
 * @param  {Number} optionsMap.limit Limits the number of instances to update to `limit`.
 * @param  {Number} optionsMap.skip Skips the first `skip` number of instances to update.
 * @param  {String,Dictionary<String, Mixed>} optionsMap.orderBy Orders the model instances to update. Please note: while using this works properly in combination with the skip and limit option, the returned model instances are returned in the correct order.
 * @return {Promise} Returns an array of model instances.
 */
Model.prototype.update = function(whereMap, setMap, optionsMap) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	var where;
	if(typeof whereMap == 'object') {
		where = this._transformWhereMap(whereMap || {});
	}
	else {
		where = {id: whereMap};
	}

	var options = optionsMap || {};

	var set = this._transformSetMap(setMap || {}, false);

	var self = this;
	return this._table.update(where, set, options.limit, options.skip, options.orderBy)
		.then(function(result) {
			return self._createModelInstances(result, 'afterUpdate');
		});
};

/**
 * Updates model instance with a limit of 1 and returns 1 model instance.
 *
 * @param {Dictionary|String} whereMapOrId Either a where map or UUID of the model instance.
 * @param {Dictionary} setMap The models to set.
 * @return {Promise} Resolves with 1 model instance.
 */
Model.prototype.updateOne = function(whereMap, setMap, optionsMap) {
	var options = optionsMap || {};
	options.limit = 1;

	return this.update(whereMap, setMap, options)
		.then(function(modelInstances) {
			if(modelInstances && modelInstances.length > 0) {
				return modelInstances[0];
			}
			else {
				return null;
			}
		});
};

/**
 * This is called by a model instance to invoke an update after {@link ModelInstance#save}.
 *
 * @access private
 *
 * @param {Dictionary} where The where clause.
 * @param {Dictionary} set   The properties to set.
 */
Model.prototype._updateOne = function(where, set) {
	return this._table.update(where, set, 1)
	.then(function(result) {
		if(result.rows.length > 0) {
			return result.rows[0];
		}
		else {
			return null;
		}
	});
};

/**
 * Finds and resolves one model instance. See {@link Model#findOne}.
 *
 * This method is similar to Model#findOne, expect that it always resolves with a model instance, or rejects the returned promise. This is useful in certain flows where you don't want to check if a model instance is null.
 *
 * @return {Promise}
 */
Model.prototype.getOne = function(where, options) {
	return this.findOne(where, options)
		.then(function(model) {
			if(model) {
				return model;
			}
			else {
				var error = new Error('Not Found');
				error.status = 404;
				throw error;
			}
		})
		.catch(function(error) {
			throw error;
		});
};

/**
 * This method is flagged as confusing and will likely change in the near future.
 *
 * Checks whether the model's table is created.
 *
 * @access private
 *
 * @return {Promise} Boolean.
 */
Model.prototype.exists = function() {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.exists();
};

/**
 * This is not implemented yet and will throw an error.
 *
 * Counts the number of model instances.
 *
 * @param  {Dictionary} whereMap There where clause. See {@link Model#find}.
 * @return {Promise} Resolves the number of model instances.
 */
Model.prototype.count = function() {
	throw new Error('Not Implemented');
};

/**
 * Removes all model instances.
 *
 * This method is only available on the server-context.
 *
 * In the server-context:
 * ```
 * MyController.prototype.deleteUsers = function() {
 * 	return this.models.User.removeAll();
 * };
 * ```
 */
Model.prototype.removeAll = function() {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.remove({});
};

/**
 * Removes a model instance matching the where map.
 *
 * @param  {Dictionary} whereMap
 * @return {Promise}
 */
Model.prototype.remove = function(whereMap, optionsMap) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	var where = this._transformWhereMap(whereMap || {});

	var keys = Object.keys(where);
	if(!keys.length) {
		throw new Error('You are calling Model#remove without a `where` clause. This will result in removing all instances. This is disabled in Model#remove. Please invoke Model#removeAll instead.');
	}

	var options = optionsMap || {};

	var self = this;
	return this._table.remove(where, options.limit, options.skip, options.orderBy)
		.then(function(result) {
			return self._createModelInstances(result);
		});
};

Model.prototype.removeOne = function(whereMap, optionsMap) {
	var options = optionsMap || {};
	options.limit = 1;

	return this.remove(whereMap, options)
		.then(function(modelInstances) {
			if(modelInstances && modelInstances.length > 0) {
				return modelInstances[0];
			}
			else {
				return null;
			}
		});
};

/**
 * Finds a model instance, or creates one if it doesn't exist.
 *
 * If a model instance is not found, one is created by merging the whereMap and the setMap. If both the maps create the same key(s), setMap the value of setMap is used.
 *
 * This method simply executes Model#findOne followed by Model#create (if no model could be found). This method will be improved by using a writable CTE/WITH.
 *
 * @param {Dictionary} whereMap
 * @param {Dictionary} setMap
 */
Model.prototype.findOrCreate = function(where, set) {
	var self = this;
	return this.findOne(where)
		.then(function(model) {
			if(!model) {
				return self.create(utils.merge(where, set));
			}
			else {
				return model;
			}
		});
};

/**
 * Either updates a model instance, or creates a new model instance if not model exists.
 *
 * This method simply executes {@link Model#updateOne} followed by {@link Model#create} if no model could be updated. This method will be improved by using a writable CTE/WITH.
 *
 * @param {Dictionary} whereMap
 * @param {Dictionary} setMap
 */
Model.prototype.updateOrCreate = function(whereMap, setMap) {
	var self = this;
	return this.updateOne(whereMap, setMap)
		.then(function(modelInstance) {
			if(!modelInstance) {
				return self.create(utils.merge(whereMap, setMap));
			}
			else {
				return modelInstance;
			}
		});
};

Model.prototype._transformSetMap = function(setMap, isNew) {
	var properties = this.getAllProperties();

	var self = this;

	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.isTransformable()) {
			var parameters = [];

			// So, let's try to resolve the transformable if we have _all_ the values.
			property.options.transformKeyNames.map(function(key) {
				var parameter = setMap[key];

				if(typeof parameter != 'undefined') {
					parameters.push(parameter);
				}
			});

			if(parameters.length == property.options.transformKeyNames.length) {
				var value = property.options.transformMethod.apply(self, parameters);
				if(value) {
					setMap[property.name] = value;
				}
			}
		}

		// If a change is set and the property type includes a hash, we'll hash it. Always.
		if(property.options.hashMethod && setMap[property.name]) {
			setMap[property.name] = property.options.hashMethod.call(self, setMap[property.name]);
		}

		// Let's check if this is a new model creation. If it's just an update we don't want to set a default value.
		if(property.options.defaultValue && !setMap[property.name] && isNew) {
			setMap[property.name] = property.options.defaultValue.call(self);
		}
	});

	return setMap;
};

Model.prototype._transformWhereMap = function(whereMap) {
	var map = {};

	var self = this;
	Object.keys(whereMap).forEach(function(propertyName) {
		var property = self.getProperty(propertyName);
		var value = whereMap[propertyName];

		if(!property) {
			throw new Error('Cannot find property `' + propertyName + '` on `' + self._name + '`');
		}

		if(property.isSelectable()) {
			var selectMap = property.options.selectMethod.apply(self, [value]);
			Object.keys(selectMap || {}).forEach(function(key) {
				map[key] = selectMap[key];
			});
		}
		else if(property.options.hashMethod) {
			map[propertyName] = property.options.hashMethod.call(self, value);
		}
		else {
			map[propertyName] = value;
		}
	});

	return map;
};

/**
 * Finds one or more model instances.
 *
 * For example, given the following User model:
 * ```
 * function User() {
 * 	this.name = [this.String];
 * 	this.age = [this.Integer];
 * }
 * app.model(User);
 * ```
 *
 * In a controller in the client-context, to fetch up to 123 user's named "Martijn":
 * ```
 * function MyController(fire) {
 * 	fire.models.User.find({name: 'Martijn'}, {limit:123})
 * }
 * app.controller(MyController);
 * ```
 *
 * The same example in a controller in the server-context:
 * ```
 * MyController.prototype.getMartijn = function() {
 * 	return this.models.User.find({name:'Martijn'}, {limit: 123});
 * };
 * ```
 *
 * The same example REST-style over HTTP:
 * ```
 * GET /api/users?name="Martijn"&$options={"limit":123}
 * ```
 *
 * @param  {Dictionary} whereMap The where clause.
 * @param {Dictionary} optionsMap Additional options for finding model instances, for example, ordering or selecting specific properties.
 * @param  {Number} optionsMap.limit Limits the number of model instances returned. This does not limit the number of associations returned. For example, if you have a User model with 3000 auto-fetched projects associated to it, all 3000 projects will be fetched even if you set the limit to 100. There is currently no way to limit the number of auto-fetched associations returned.
 * @param {Number} optionsMap.skip Skips the first number of model instances. This does not affect the associations.
 * @param  {String|Dictionary<String, Mixed>} optionsMap.orderBy Orders the model instances. `orderBy` can either be an SQLish statement (see {@link Table#parseSQLishStatement}) or a dictionary with property name and value pairs. The value of a pair can either be a string (DESC, or ASC) or a number (-1 and lower for DESC and 0 and higher ASC).
 * @param {String|String[]} optionsMap.groupBy The property name(s) to group by.
 * @param  {String[]} optionsMap.select The properties to select. By default all properties are selected. If you specify an array only those properties are selected.
 *
 * This is useful if you want to limit the number of properties to fetch of the model and it's associations.
 *
 * To limit the properties to only `name` and `id` of the `User` model, see the example below. The `id` property is always included automatically.
 * ```
 * models.User.find({}, {select:['name']});
 * ```
 *
 * If the property is an non-auto fetched association, the association is not fetched automatically. To fetch non-auto fetched associations, use the `optionsMap.associations` key.
 *
 * You also need to specify the properties of any auto-fetched associations, else only their `id` property is returned. You can do this via the dot notation. For example, given a `User` model with a one-to-many `projects` association:
 * ```
 * models.User.find({name: 'Martijn'}, {select:['name', 'projects.name']})
 * 	.then(function(user) {
 * 		// user
 * 	});
 * ```
 *
 * You can also select all properties of an association by supplying a `*`:
 * ```
 * models.User.find({name: 'Martijn'}, {select:['name', 'projects.*']})
 * 	.then(function(user) {
 * 		// user
 * 	});
 * ```
 *
 * Please note if you try to access properties on a model instance not in the `select` list, the property's value will be undefined.
 *
 * @param  {Array} optionsMap.associations An array of property names of the associations to fetch. This is useful if you need an association but it's not configured as auto fetch (see {@link PropertyTypes#AutoFetch}).
 * @return {Promise}           Resolves with an array of model instances. If no model instances are found, with an empty array is resolved.
 */
Model.prototype.find = function(whereMap, optionsMap) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	var options = optionsMap || {};
	var where = whereMap || {};
	where = this._transformWhereMap(where);

	var self = this;
	return this._table.select(where, options.limit, options.skip, options.orderBy, options.groupBy, options.select, options.associations)
		.then(function(result) {
			return self._createModelInstances(result);
		});
};

/**
 * Creates model instances from a datastore result.
 *
 * @access private
 *
 * @param {Dictionary} datastoreResult The result object from a {@link Datastore#query} call.
 */
Model.prototype._createModelInstances = function(datastoreResult, hookName) {
	// We can't simply pass all the rows to new model instances
	// We'll create an instance let is consumer rows, and the instance can decide if it rejects it
	var instances = [];
	var instance = null;

	// When there are many associations, we're sorting everything by id
	// TODO: We really shouldn't sort by id anymore--as it's a UUID now instead of a SERIAL.

	var self = this;
	datastoreResult.rows.forEach(function(row) {
		if(!instance || !instance.consumeRow(row)) {
			instance = new ModelInstance(self, row, null, row.id, hookName);
			instances.push(instance);
		}
	});

	return instances;
};

/**
 * Finds one model instance.
 *
 * @param {Dictionary} whereMap
 * @param {Dictionary} optionsMap
 * @return {Promise}
 */
Model.prototype.findOne = function(whereMap, optionsMap) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	var options = optionsMap || {};
	options.limit = 1;

	return this.find(whereMap, options)
		.then(function(instances) {
			if(instances.length) {
				return instances[0];
			}
			else {
				return null;
			}
		});
};

/**
 * Creates one or more model instances.
 *
 * For example, to create one user model instance:
 * ```
 * models.User.create({
 * 	name: 'Martijn'
 * });
 * ```
 *
 * But, you can also create multiple model instances:
 * ```
 * models.User.create([{
 * 		name: 'Martijn'
 * 	}, {
 * 		name: 'John'
 * 	}
 * ]);
 * ```
 *
 * When creating multiple model instances, they are created one-by-one and no bulk-insert is performed. This is an improvement for a future release.
 *
 * @param  {Array|Dictionary} fields
 * @return {Promise}        			Either resolves with a model instance, or an array of model instances.
 */
Model.prototype.create = function(fields) {
	if(util.isArray(fields)) {
		var self = this;

		// TODO: This should be true bulk-insert.

		return Q.all(fields.map(function(createMap) {
			return (new ModelInstance(self, null, createMap)).save();
		}));
	}
	else {
		return (new ModelInstance(this, null, fields)).save();
	}
};

/**
 * Destroys the model's table by dropping it. This even drops the model's table if any associations to any of the model instances exists.
 *
 * @access private
 */
Model.prototype.forceDestroy = function() {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.drop(true);
};

/**
 * Destroys the model's table by dropping it.
 *
 * This method does not drop a table if any associations still exist. To force the drop, use Model#forceDestroy.
 *
 * @access private
 *
 * @return {Promise}
 */
Model.prototype.destroy = function() {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	return this._table.drop(false);
};

/**
 * Sets the permission of a given action on the model to a given key path or function.
 *
 * See AccessControl for more information.
 *
 * @access private
 *
 * @param {String} action                    The type of action: create, read, update, delete.
 * @param {String|Function} propertyKeyPathOrFunction
 */
Model.prototype.setAccessControl = function(action, propertyKeyPathOrFunction) {
	if(typeof propertyKeyPathOrFunction == 'function') {
		this._accessControl.setPermissionFunction(action, propertyKeyPathOrFunction);
	}
	else {
		this._accessControl.setPermissionKeyPath(action, propertyKeyPathOrFunction);
	}
};

/**
 * Returns the models access control instance.
 *
 * @access private
 */
Model.prototype.getAccessControl = function() {
	return this._accessControl;
};

/**
 * Executes an SQLish statement on the model. To execute a raw sql statement, see {Models#execute}.
 *
 * @param  {String} sql    	SQLish statement.
 * @param  {Array} values 	An array of values
 * @return {Promise}        Resolves with an array of model instances.
 */
Model.prototype.execute = function(sql, values) {
	if(this._activeMigration) {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(args, 0));
	}

	var self = this;
	return this._table.execute(sql, values)
		.then(function(result) {
			return self._createModelInstances(result);
		});
};
