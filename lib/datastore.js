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

	this.setAllProperties(Model);
}

Datastore.prototype.setAllProperties = function(ModelClass) {
	for(var propertyName in Table.propertyTypes) {
		ModelClass.prototype[propertyName] = Table.propertyTypes[propertyName];
	}
}

Datastore.prototype.getModel = function() {
	/*
	// Check if this Model is prepared already
	if(!Model.prototype.isPrepared) {
		this.setAllProperties(Model);
	}
	*/

	// TODO: deprecate this: throw new Error('Datastore#getModel() is deprecated. require(\'model\') instead.');
	// But we do need to verify if this is one of the first things being done? Maybe move it to model instead? Or models?
	return Model;
}

Datastore.prototype.addModel = function(modelName, model) {
	var table = new Table(modelName, this);
	this._tables.push(table);
	model.setTable(table);
}

Datastore.prototype.setupTable = function(table) {
	return table.create();
};
