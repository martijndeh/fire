'use strict';

exports = module.exports = Model;

var Table = require('./table');
var SQLiteTable = require('./datastores/sqlite3/table');

var inflection = require('inflection');
var util = require('util');
var utils = require('./utils');
var ModelInstance = require('./model-instance');
var Property = require('./property');

function Model(name, models, workers) {
	this._name = name;
	this.models = models;
	this.workers = workers;

	this._properties = null;
	this._table = null;
	this._autoFetch = {};
}

Model.prototype.getAutoFetch = function() {
	return this._autoFetch;
}

Model.prototype.setTable = function(table) {
	this._table = table;
};

Model.prototype.getTable = function() {
	return this._table;
}

Model.prototype.getName = function() {
	return this._name;
}

Model.prototype.addProperty = function(propertyName, propertyTypes) {
	var property = new Property(propertyName, propertyTypes, this.models);
	this._properties[property.name] = property;

	// TODO: check auto fetch, references, etc
	if(property.autoFetch) {
		this._autoFetch[property.name] = property;
	}

	return property;
};

Model.prototype.removeProperty = function(property) {
	// TODO: check auto fetch, reference, etc

	if(property.autoFetch) {
		delete this._autoFetch[property.name];
	}

	delete this._properties[property.name];
};

Model.prototype.getAllProperties = function() {
	if(!this._properties) {
		this._properties = {};

		//now create the default properties
		this.id				= [this.Id];
		this._properties.id = new Property('id', [this.Id], this.models);

		for(var propertyName in this) {
			var propertyTypes = this[propertyName];
			if(util.isArray(propertyTypes) && !Model.prototype[propertyName]) {
				this.addProperty(propertyName, propertyTypes);
			}
		}
	}

	return this._properties;
};

Model.prototype.addProperties = function(properties, persist) {
	var addedProperties = {};

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self[propertyName] = properties[propertyName];
		
		var property = self.addProperty(propertyName, properties[propertyName]);
		addedProperties[property.name] = property;
	});

	return this._table.addProperties(addedProperties, persist);
};

Model.prototype.removeProperties = function(propertyNames, persist) {
	var self = this;
	propertyNames.forEach(function(propertyName) {
		delete self[propertyName];

		var property = self._properties[propertyName];

		self.removeProperty(property);
	});

	return this._table.removeProperties(propertyNames, persist);
};

Model.prototype.setup = function() {
	return this._table.create();
};

Model.prototype._create = function(setMap) {
	return this._table.insert(setMap)
	.then(function(result) {
		return result.rows[0];
	});
};

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
				throw new Error();
			}
		})
		.fail(function(error) {
			throw error;
		});
};

Model.prototype.exists = function() {
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
	return this._table.remove({});
};

Model.prototype.remove = function(whereMap) {
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
	var self = this;

	return this._table.select(whereMap, null, sort)
	.then(function(result) {
		return result.rows.map(function(row) {
			return new ModelInstance(self, row, null);
		});
	});
};

Model.prototype.findOne = function(whereMap, sort) {
	var self = this;

	return this._table.select(whereMap, 1, sort)
	.then(function(result) {
		if(result.rowCount == 1) {
			return new ModelInstance(self, result.rows[0], null);
		}
		else {
			return null;
		}
	});
};

Model.prototype.createOne = function(fields) {
	return (new ModelInstance(this, null, fields)).save();
};

Model.prototype.destroy = function() {
	return this._table.drop();
};

Model.prototype.execute = function(query, params) {
	return this._table.query(query, params);
};

