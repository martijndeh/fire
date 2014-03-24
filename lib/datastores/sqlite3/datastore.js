'use strict';

exports = module.exports = SQLite;

var Datastore = require('./../../datastore');
var sqlite3 = require('sqlite3').verbose();
var util = require('util');

var SQLiteTable = require('./table');

var Q = require('q');

function SQLite(databaseURL) {
	this.database = new sqlite3.Database(databaseURL);

	Datastore.apply(this, arguments);
}

util.inherits(SQLite, Datastore);

SQLite.prototype.setAllProperties = function(Model) {
	Datastore.apply(this, arguments);

	for(var propertyName in SQLiteTable.propertyTypes) {
		Model.prototype[propertyName] = SQLiteTable.propertyTypes[propertyName];
	}
}

SQLite.prototype.createTable = function(modelName, modelProperties) {
	return new SQLiteTable(modelName, modelProperties, this);
};

SQLite.prototype.convertParameters = function(parameters) {
	var set = {};
	if(parameters) {
		parameters.forEach(function(param, index) {
			set['$' + (index + 1)] = param;
		});
	}
	return set;
}

SQLite.prototype.run = function(query, parameters) {
	var defer = Q.defer();

	this.database.run(query, this.convertParameters(parameters), function(error) {
		if(error) {
			defer.reject(error);
		}
		else {
			defer.resolve({
				changes: this.changes,
				lastID: this.lastID
			});
		}
	});

	return defer.promise;
}

SQLite.prototype.query = function(query, parameters) {
	var defer = Q.defer();

	var self = this;
	this.database.all(query, this.convertParameters(parameters), function(error, rows) {
		if(error) {
			defer.reject(error);
		}
		else {
			defer.resolve({
				rowCount: rows.length,
				rows: rows
			});
		}
	});

	return defer.promise;
};
