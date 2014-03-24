'use strict';

exports = module.exports = SQLiteTable;

var Table = require('../../table');
var util = require('util');
var inflection = require('inflection');

function SQLiteTable() {
	Table.apply(this, arguments);
}

util.inherits(SQLiteTable, Table);

SQLiteTable.propertyTypes = {
	Id: 'INTEGER PRIMARY KEY AUTOINCREMENT'
};

SQLiteTable.prototype.updateStatement = function(set, where, limit) {
	return (
		'UPDATE "' + this.name + '"' +
		this.setClause(set) +
		this.whereClause(where, set.length + 1)
	);
};

SQLiteTable.prototype.insertStatement = function(set) {
	return (
		'INSERT INTO "' + this.name + '"' +
		'(' + set.map(function(propertyName) {
			var columnName = inflection.underscore(propertyName);

			//if column name is a reference, change to foreign key?!

			return '"' + columnName + '"';
		}).join(', ') + ')' +
		' VALUES (' +
			set.map(function(a, index) {
				return '$' + (index + 1);
			}).join(', ') +
		')'
	);
};

SQLiteTable.prototype.insert = function(keys, values) {
	var self = this;
	return this._datastore.connect()
		.then(function(client) {
			return client.run(self.insertStatement(keys), values);
		})
		.then(function(result) {
			return self.select(['id'], 1, [result.lastID]);
		});
};

SQLiteTable.prototype.update = function(setKeys, whereKeys, limit, values) {
	var self = this;
	return this._datastore.connect()
		.then(function(client) {
			return client.query(self.updateStatement(setKeys, whereKeys, limit), values);
		})
		.then(function(_) {
			// Now, do a select based on where clause
			// TODO: if columns get changed which are in the where clause, this one fails
			return self.select(whereKeys, 1, values.slice(setKeys.length));
		});
};

SQLiteTable.prototype.existsStatement = function() {
	return 'SELECT name FROM sqlite_master WHERE type = "table" AND name = $1';
}
