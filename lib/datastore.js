'use strict';

exports = module.exports = Datastore;

var Q = require('q');
var Client = require('./client');
var url = require('url');
var Table = require('./table');
var PostgresDatastore = require('./datastores/postgres/datastore');
var SQLiteDatastore = require('./datastores/sqlite3/datastore');
var Model = require('./model');

Datastore.factory = function(databaseURL) {
	var datastore = null;

	if(databaseURL) {
		var object = url.parse(databaseURL);

		switch(object.protocol) {
			case 'postgres:':
			case 'pg:':
				datastore = new PostgresDatastore(databaseURL);
				break;

			case 'sqlite3':
				datastore = new SQLiteDatastore(databaseURL);
				break;
		}
	}
	else {
		datastore = new SQLiteDatastore(':memory:');
	}

	return datastore;
};

function Datastore(databaseURL) {
	this._tables = [];
}

Datastore.prototype.setAllProperties = function(Model) {
	for(var propertyName in Table.propertyTypes) {
		Model.prototype[propertyName] = Table.propertyTypes[propertyName];
	}
}

Datastore.prototype.getModel = function() {
	this.setAllProperties(Model);
	return Model;
}

Datastore.prototype.createTable = function(modelName, modelProperties) {
	return new Table(modelName, modelProperties, this);
};

Datastore.prototype.addModel = function(modelName, model) {	
	var table = this.createTable(modelName, model.getAllProperties());
	this._tables.push(table);

	model.setTable(table);
}

Datastore.prototype.setupTable = function(table) {
	return table.create();
};
