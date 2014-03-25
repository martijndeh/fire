'use strict';

exports = module.exports = Model;

var Table = require('./table');
var SQLiteTable = require('./datastores/sqlite3/table');

var inflection = require('inflection');
var util = require('util');
var utils = require('./utils');
var ModelInstance = require('./model-instance');

function Model(models) {
	this.models = models;
	this._table = null;
}

Model.prototype.setTable = function(table) {
	this._table = table;
};

Model.prototype.getAllProperties = function() {
	var properties = {};

	//now create the default properties
	this.id = [this.Id];
	properties.id = [this.Id];

	for(var propertyName in this) {
		var propertyTypes = this[propertyName];
		if(util.isArray(propertyTypes) && !Model.prototype[propertyName]) {
			properties[propertyName] = propertyTypes;
		}
	}

	return properties;
};

//todo: hijack some of these methods so we can cleanly implement associations
Model.prototype.propertyTypes = {
	Reference: function(modelOrName) {
		return function(columnName) {
			//todo: return a method :-)
		};
	}
};

for(var propertyName in Model.prototype.propertyTypes) {
	if(Model.prototype[propertyName]) {
		//todo: replace this with our Model#propertyTypes but still call it
		//this seperates SQL stuff from Model stuff
	}
}

Model.prototype.setup = function() {
	return this._table.create();
};

function toValues(map) {
	return Object.keys(map).map(function(propertyName) {
		var value = map[propertyName];

		if(value instanceof ModelInstance) {
			return value.id;
		}

		return value;
	});
}

Model.prototype._create = function(set) {
	return this._table.insert(Object.keys(set), toValues(set))
	.then(function(result) {
		return result.rows[0];
	});
};

Model.prototype.updateOne = function(where, set) {
	var self = this;
	return this._updateOne(where, set)
	.then(function(row) {
		return new ModelInstance(self, row, null);
	});
}

Model.prototype._updateOne = function(where, set) {
	return this._table.update(Object.keys(set), Object.keys(where), 1, toValues(set).concat(toValues(where)))
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
}

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
	return this._table.remove([], []);
};

Model.prototype.remove = function(where) {
	var keys = Object.keys(where || {});
	if(!keys.length) {
		throw new Error('You are calling Model#remove without a `where` clause. This will result in removing all instances. This is disabled in Model#remove. Please invoke Model#removeAll instead.');
	}
	else {
		return this._table.remove(Object.keys(where), toValues(where))
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
}

Model.prototype.findOne = function(where, sort) {
	var self = this;
	return this._table.select(Object.keys(where), 1, toValues(where), sort)
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
}

Model.prototype.addProperties = function(properties, persist) {
	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self[propertyName] = properties[propertyName];
	});

	return this._table.addProperties(properties, persist);
};

Model.prototype.removeProperties = function(propertyNames, persist) {
	// We want to collect the property types as well, as we likely need it to calculate some column names in the table
	var properties = {};

	var self = this;
	propertyNames.forEach(function(propertyName) {
		properties[propertyName] = self[propertyName];
		delete self[propertyName];
	});

	return this._table.removeProperties(properties, persist);
};
