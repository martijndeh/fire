exports = module.exports = Datastore;

var Q = require('q');
var Client = require('./client');
var url = require('url');
var Table = require('./table');
var PostgresDatastore = require('./datastores/postgres/datastore');
var SQLiteDatastore = require('./datastores/sqlite3/datastore');
var Model = require('./model');
var utils = require('./utils');

Datastore.factory = function(databaseURL) {
	var datastore = null;

	if(databaseURL) {
		var object = url.parse(databaseURL);

		switch(object.protocol) {
			case 'postgres:':
			case 'pg:':
				datastore = new PostgresDatastore(databaseURL);
				break;

			default:
				throw new Error('Invalid DATABASE_URL set: only pg and postgres schemes are supported.');
				break;
		}
	}
	else {
		datastore = new PostgresDatastore();
	}

	return datastore;
};

function Datastore(databaseURL) {
	var self = this;
	Object.keys(Table.propertyTypes).forEach(function(propertyName) {
		// We check if it's set already, as e.g. migrations swizzle these methods
		if(!Model.prototype[propertyName]) {
			Model.prototype[propertyName] = Table.propertyTypes[propertyName];
		}
	});
	
	this._tables = [];
}

Datastore.prototype.setAllProperties = function(ModelClass) {
	throw new Error('Datastore#setAllProperties deprecated in favor of Datastore.setup().');
	
	/*
	for(var propertyName in Table.propertyTypes) {
		ModelClass.prototype[propertyName] = Table.propertyTypes[propertyName];
	}
	*/
}

Datastore.prototype.getModel = function() {
	throw new Error('Datastore#getModel() is deprecated. require(\'model\') instead.');
}

Datastore.prototype.addModel = function(modelName, model) {
	var schemaName = model.schemaName || null;

	var table = new Table(schemaName, modelName, this);
	this._tables.push(table);
	model.setTable(table);
}

Datastore.prototype.setupTable = function(table) {
	return table.create();
};
