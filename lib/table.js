'use strict';

exports = module.exports = Table;

var util = require('util');
var inflection = require('inflection');

function Table(name, properties, datastore) {
	this.name = inflection.tableize(name);
	this.columns = [];
	this._datastore = datastore;

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self.addProperty(propertyName, properties[propertyName]);
	});
}

/**
 * Property types are used as property definitions by models. Every property gets set on the Model's prototype. This is a bit of magic—but it allows us to definite models without any "require()"'s.
 */
Table.propertyTypes = {
	Text: 'TEXT',
	String: 'TEXT',
	Number: 'INTEGER',
	Integer: 'INTEGER',
	Date: 'DATE',
	DateTime: function() {
		return Table.propertyTypes.Timestamp;
	},
	Timestamp: 'TIMESTAMP WITH TIME ZONE',
	Time: 'TIME WITH TIME ZONE',
	Interval: 'INTERVAL',

	Unsigned: 'UNSIGNED',
	Serial: 'SERIAL',
	PrimaryKey: 'PRIMARY KEY',
	Unique: 'UNIQUE',
	Required: 'NOT NULL',

	Id: 'SERIAL PRIMARY KEY',

	Default: function(defaultValue) {
		return 'DEFAULT ' + defaultValue;
	},
	Reference: function(modelNameOrModel) {
		return 'INTEGER REFERENCES ' + inflection.tableize(modelNameOrModel) + '(id)';
	},
	SelfReference: function() {
		return function(columnName) {
			return Table.propertyTypes.Reference(columnName);
		};
	}
};

Table.prototype.addProperty = function(propertyName, propertyTypes) {
	var columnName = inflection.underscore(propertyName);

	var clauses = propertyTypes.map(function(propertyType) {
		if(typeof propertyType == 'function') {
			//OK, this is a little weird: in a model, we can do this.SelfReference.
			//SelfReference returns a function when called, but without parameter, it doesn't get called
			//so we invoke a function with the column name--if it returns function, we call that function with the column name

			var result = propertyType.call(this, columnName);
			if(typeof result == 'function') {
				return result.call(this, columnName);
			}

			return result;
		}
		else {
			return propertyType;
		}
	});

	this.addColumn(columnName, clauses);
};

Table.prototype.query = function(query, parameters) {
	return this._datastore.query(query, parameters);
};

Table.prototype.addColumn = function(name, clauses) {
	if(this.columns[name]) {
		throw new Error('Column ' + name + ' already exists.');
	}

	this.columns[name] = clauses;
};

Table.prototype.sortClause = function(sort) {
	if(sort) {
		return ' ORDER BY ' +
			Object.keys(sort).map(function(propertyName) {
				var columnName = inflection.underscore(propertyName);
				var sortValue = sort[propertyName];

				return '"' + columnName + '" ' + sortValue;
			}).join(', ');
	}

	return '';
};

Table.prototype.whereClause = function(where, offset) {
	if(where && where.length > 0) {
		var i = offset || 1;
		return (
			' WHERE ' +
				where.map(function(propertyName) {
					return '"' + inflection.underscore(propertyName) + '" = ' + '$' + (i++);
				}).join(' AND ')
		);
	}
	return '';
};

Table.prototype.setClause = function(set, offset) {
	var i = offset || 1;
	return (
		' SET ' + set.map(function(propertyName) {
			return '"' + inflection.underscore(propertyName) + '" = ' + '$' + (i++);
		}).join(', ')
	);
};

Table.prototype.limitClause = function(limit) {
	return ((limit > 0) ? (' LIMIT ' + limit) : (''));
};

Table.prototype.createStatement = function() {
	return (
		'CREATE TABLE "' + this.name + '" (\n' +
			Object.keys(this.columns).map(function(columnName) {
				// TODO: if column is a reference, change it to a foreign key
				return '\t"' + columnName + '" ' + this.columns[columnName].join(' ');
			}, this).join(',\n') +
		'\n);'
	);
};

Table.prototype.selectStatement = function(where, limit, sort) {
	return (
		'SELECT * FROM ' +
		'"' + this.name + '"' +
		this.whereClause(where) +
		this.sortClause(sort) +
		this.limitClause(limit)
	);
};

Table.prototype.updateStatement = function(set, where, limit) {
	return (
		'UPDATE "' + this.name + '"' +
		this.setClause(set) +
		this.whereClause(where, set.length + 1) +
		' RETURNING *'
	);
};

Table.prototype.insertStatement = function(set) {
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
		') RETURNING *'
	);
};

Table.prototype.dropStatement = function() {
	return (
		'DROP TABLE "' + this.name + '"'
	);
};

Table.prototype.deleteStatement = function(where) {
	return (
		'DELETE FROM "' + this.name + '" ' + this.whereClause(where)
	);
};

Table.prototype.insert = function(keys, values) {
	return this.query(this.insertStatement(keys), values);
};

Table.prototype.update = function(setKeys, whereKeys, limit, values) {
	return this.query(this.updateStatement(setKeys, whereKeys, limit), values);
};

Table.prototype.select = function(whereKeys, limit, values, sort) {
	return this.query(this.selectStatement(whereKeys, limit, sort), values);
};

Table.prototype.remove = function(whereKeys, values) {
	return this.query(this.deleteStatement(whereKeys), values);
};

Table.prototype.create = function() {
	return this.query(this.createStatement());
};

Table.prototype.drop = function() {
	return this.query(this.dropStatement());
};

Table.prototype.existsStatement = function() {
	return 'SELECT * FROM information_schema.tables WHERE table_name = $1';
};

Table.prototype.exists = function() {
	var self = this;
	return this.query(this.existsStatement(), [this.name])
		.then(function(result) {
			return (result.rows.length > 0);
		});
};
