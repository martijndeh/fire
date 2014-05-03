exports = module.exports = Model;

//var Table = require('./table');

var inflection = require('inflection');
var util = require('util');
var utils = require('./utils');
var ModelInstance = require('./model-instance');
var Property = require('./property');

function Model(name, models, workers, activeMigration) {
	this._name = name;
	this.models = models;
	this.workers = workers;

	this._properties = null;
	this._table = null;

	this._associations = {};

	this._activeMigration = activeMigration;
}

Model.prototype.setActiveMigration = function(migration) {
	this._activeMigration = migration;
};

Model.prototype.getAssociations = function() {
	return this._associations;
};

Model.prototype.removeAllAssociations = function() {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		self.removeProperty(self._associations[associationName]);
	});
};

Model.prototype.findAssociationsTo = function(model) {
	var associations = [];

	var self = this;
	Object.keys(this._associations).forEach(function(name) {
		var association = self._associations[name];

		if(association.getAssociatedModel() == model || association.options.referenceName == model.getName()) {
			associations.push(association);
		}
	})

	return associations;
}

Model.prototype.setTable = function(table) {
	this._table = table;
};

Model.prototype.getTable = function() {
	if(!this._table) {
		throw new Error('No table exists for model `' + this.getName() + '`.');
	}

	return this._table;
};

Model.prototype.getName = function() {
	return this._name;
};

Model.prototype.addProperty = function(property, isNew) {
	!isNew && this._activeMigration && this._activeMigration.addProperty(property);

	this._properties[property.name] = property;

	if(property.isAssociation()) {
		if(this._associations[property.name]) {
			throw new Error('Duplicate association `' + property.name + '` in `' + this.getName() + '`.');
		}

		this._associations[property.name] = property;
	}

	return property;
};

Model.prototype._addProperty = function(propertyName, propertyTypes, isNew) {
	if(propertyTypes && propertyTypes.length > 0) {
		return this.addProperty(new Property(propertyName, propertyTypes, this, this.models), isNew);
	}
	return null;
};

Model.prototype.removeManyAssociationTo = function(model) {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		var association = self._associations[associationName];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		if(association.manyAssociation && association.getAssociatedModel() == model) {
			self.removeProperty(association);
		}
	});
};

Model.prototype.removeOneAssociationTo = function(model) {
	var self = this;
	Object.keys(this._associations).forEach(function(associationName) {
		var association = self._associations[associationName];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		if(association.oneAssociation && association.getAssociatedModel() == model) {
			self.removeProperty(association);
		}
	});
};

Model.prototype.removeProperty = function(property) {
	this._activeMigration && this._activeMigration.removeProperty(property);

	delete this._properties[property.name];

	if(property.isAssociation()) {
		delete this._associations[property.name];

		// TODO: This (the below) is not working anymore. It seems not to be used anyway?

		// If this is a Many association, we might want to remove the original property
		if(property.manyAssociation) {
			property.getAssociatedModel().removeOneAssociationTo(this);
		}
		else if(property.oneAssociation) {
			// TODO: this isn't really safe... there could be more associations really
			property.getAssociatedModel().removeManyAssociationTo(this);
		}	
	}
};

Model.prototype.getProperty = function(propertyName) {
	return this._properties[propertyName];
};

Model.prototype.getAllProperties = function() {
	if(!this._properties) {
		this._properties = {};

		// Now we create the default properties, currently only Id
		// There is a catch here: if it's already set by the user, we don't do anything
		// Even if it's set to something like [] (which gets ignored)
		if(!this.id) {
			this.id				= [this.Id];
			this._properties.id = new Property('id', [this.Id], this, this.models);
		}

		for(var propertyName in this) {
			var propertyTypes = this[propertyName];
			if(util.isArray(propertyTypes) && !Model.prototype[propertyName]) {
				this._addProperty(propertyName, propertyTypes, true);
			}
		}
	}

	return this._properties;
};

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

	return this._table.addProperties(addedProperties);
};

Model.prototype.edit = function(addedProperties, removedProperties) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}
	
	return this._table.alter(addedProperties, removedProperties);
};

Model.prototype.removeProperties = function(propertyNames) {
	var self = this;
	propertyNames.forEach(function(propertyName) {
		delete self[propertyName];

		var property = self._properties[propertyName];

		self.removeProperty(property);
	});

	return this._table.removeProperties(propertyNames);
};

Model.prototype.setup = function() {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.create();
};

Model.prototype._create = function(setMap) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.insert(setMap)
		.then(function(result) {
			return result.rows[0];
		});
};

Model.prototype.update = function(whereMap, setMap) {
	// TODO: what is update() vs updateOne()?!
	return this.updateOne(whereMap, setMap);
}

Model.prototype.updateOne = function(where, set) {
	var self = this;
	return this._updateOne(where, set)
	.then(function(row) {
		if(row) {
			return new ModelInstance(self, row, null);
		}
		else {
			var error = new Error('Did not match any instance to update.');
			error.status = 400;
			throw error;
		}
	});
};

Model.prototype._updateOne = function(where, set) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.update(where, set, 1)
	.then(function(result) {
		return result.rows[0];
	});
};

Model.prototype.getOne = function() {
	return this.findOne.apply(this, Array.prototype.slice.call(arguments))
		.then(function(model) {
			if(model) {
				return model;
			}
			else {
				var error = new Error('Could not find model.');
				error.status = 404;
				throw error;
			}
		})
		.fail(function(error) {
			throw error;
		});
};

Model.prototype.exists = function() {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.exists();
};

/*
Model.prototype.count = function(where) {
	return this._table.count(Object.keys(where), Object.keys(where).map(function(propertyName) {
		return where[propertyName];
	}))
	.then(function(result) {
		console.dir(result);
	});
}
*/

Model.prototype.removeAll = function() {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.remove({});
};

Model.prototype.remove = function(whereMap) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	var keys = Object.keys(whereMap || {});
	if(!keys.length) {
		throw new Error('You are calling Model#remove without a `where` clause. This will result in removing all instances. This is disabled in Model#remove. Please invoke Model#removeAll instead.');
	}
	else {
		return this._table.remove(whereMap)
		.then(function(result) {
			return true;
		});
	}
};

Model.prototype.findOrCreateOne = function(where, set) {
	console.log('Model#findOrCreateOne is being replaced by Model#findOrCreate.');
	
	return this.findOrCreate(where, set);
};

Model.prototype.findOrCreate = function(where, set) {
	var self = this;
	return this.findOne(where)
	.then(function(model) {
		if(!model) {
			return self.createOne(utils.merge(where, set));
		}
		else {
			return model;
		}
	});
};

Model.prototype.find = function(whereMap, sort) {
	if(this._activeMigration) {		
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	var self = this;

	return this._table.select(whereMap || {}, null, sort)
	.then(function(result) {
		// We can't simply pass all the rows to new model instances
		// We'll create an instance let is consumer rows, and the instance can decide if it rejects it
		var instances = [];
		var instance = null;

		// When there are many associations, we're sorting everything by id

		result.rows.forEach(function(row) {
			if(!instance || !instance.consumeRow(row)) {
				instance = new ModelInstance(self, row, null);
				instances.push(instance);
			}
		});

		return instances;
	});
};

Model.prototype.findOne = function(whereMap, sort) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	var self = this;

	// OK, please note, findOne() returns 1 model instance, but may return all associations
	// There is currently no way to enforce a limit

	return this._table.select(whereMap || {}, null, sort)
	.then(function(result) {
		if(result.rowCount > 0) {
			var instance = null;
			for(var i = 0, il = result.rows.length; i < il; i++) {
				var row = result.rows[i];
				if(!instance) {
					instance = new ModelInstance(self, row, null);
				}
				else {
					if(!instance.consumeRow(row)) {
						break;
					}
				}
			}
			return instance;
		}
		else {
			return null;
		}
	});
};

Model.prototype.create = function(fields) {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return (new ModelInstance(this, null, fields)).save();
};

Model.prototype.createOne = function(fields) {
	console.log('Model#createOne is being replaced by Model#create.');
	return this.create(fields);
};

Model.prototype.forceDestroy = function() {
	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.drop(true);
}

Model.prototype.destroy = function(cascade) {
	if(cascade) {
		throw new Error('WARNING: Use Model#forceDestroy instead of Model#destroy(true) to drop cascade tables.');
	}

	if(this._activeMigration) {
		return this._activeMigration.addTask(this, utils.getMethodName(arguments.callee, Model.prototype), Array.prototype.splice.call(arguments, 0));
	}

	return this._table.drop(false);
};

Model.prototype.execute = function(query, params) {
	throw new Error('This method is deprecated. Please use Models#execute() instead.');
};

