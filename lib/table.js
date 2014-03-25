'use strict';

var debug = require('debug')('fire:sql');

exports = module.exports = Table;

var inflection = require('inflection');

function Table(name, properties, datastore) {
	this.name = inflection.tableize(name);
	this.columns = {};
	this._datastore = datastore;

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self.addProperty(propertyName, properties[propertyName]);
	});
}

Table.propertyTypes = {
	Text: 'TEXT',
	String: 'TEXT',
	Number: 'INTEGER',
	Integer: 'INTEGER',
	Date: 'DATE',
	DateTime: function() {
		return Table.propertyTypes.Timestamp;
	},
	Timestamp: 'TIMESTAMP WITHOUT TIME ZONE',
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
		if(typeof modelNameOrModel == 'string') {
			return 'INTEGER REFERENCES ' + inflection.tableize(modelNameOrModel) + '(id)';
		}
		else {
			return 'INTEGER REFERENCES ' + modelNameOrModel._table.name + '(id)';
		}
	},
	SelfReference: function() {
		return function(columnName) {
			return Table.propertyTypes.Reference(columnName);
		};
	}
};

Table.prototype.addProperties = function(properties, persist) {
	var columns = {};

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self.addProperty(propertyName, properties[propertyName], function(columnName, clauses) {
			self.addColumn(columnName, clauses);

			columns[columnName] = clauses;
		});
	});

	if(persist) {
		return this.query(this.alterStatement(columns));
	}
};

Table.prototype.removeProperties = function(properties, persist) {
	var columnNames = [];

	// Now, figure out all the column names we want to remove
	// To calculate the column name we need to property types as well

	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		self.addProperty(propertyName, properties[propertyName], function(columnName, clauses) {
			delete self.columns[columnName];

			columnNames.push(columnName);
		});
	});

	if(persist) {
		return this.query(this.alterStatement(null, columnNames));
	}
};

Table.prototype.addProperty = function(propertyName, propertyTypes, callback) {
	var columnName = inflection.underscore(propertyName);

	var clauses = propertyTypes.map(function(propertyType) {
		if(typeof propertyType == 'function') {
			// OK, this is a little weird: in a model, we can do this.SelfReference.
			// SelfReference returns a function when called, but without parameter, it doesn't get called
			// so we invoke a function with the column name--if it returns function, we call that function with the column name

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

	if(callback) {
		callback(columnName, clauses);
	}
	else {
		this.addColumn(columnName, clauses);
	}
};

Table.prototype.query = function(query, parameters) {
	debug('Table#query %s (%s)', query, JSON.stringify(parameters));
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

Table.prototype.createWhereClause = function(where, offset) {
	var result = {
		clause: '',
		values: []
	};

	var propertyNames = Object.keys(where);
	if(propertyNames.length > 0) {
		result.clause += ' WHERE ';

		var i = offset || 1;

		// TODO: how do we want to specify do OR's?
		result.clause += propertyNames.map(function(propertyName) {
			var property = where[propertyName];
			var columnName = '"' + inflection.underscore(propertyName) + '"';

			if(property === null) {
				return columnName + ' IS NULL';
			}
			else if(property && typeof property.toQueryValue == 'function') {
				result.values.push(property.toQueryValue());
				return columnName + ' = $' + (i++);
			}
			else if(typeof property == 'object' && !(property instanceof Date)) {
				return '(' + (Object.keys(property).map(function(key) {
					var transformers = {
						$gte: '>=',
						$gt: '>',
						$lt: '<',
						$lte: '<='
					};

					if(!transformers[key]) {
						throw new Error('Invalid transformer `' + key + '`.');
					}

					result.values.push(property[key]);
					return columnName + ' ' + transformers[key] + ' $' + (i++);
				}).join(' AND ')) + ')';
			}
			else {
				result.values.push(property);
				return columnName + ' = $' + (i++);
			}
		}).join(' AND ');
	}

	return result;
};

Table.prototype.createSetClause = function(setMap, offset) {
	var result = {
		clause: '',
		values: []
	};

	var i = offset || 1;

	result.clause += 'SET ';
	result.clause += Object.keys(setMap).map(function(propertyName) {
		var property = setMap[propertyName];
		var columnName = '"' + inflection.underscore(propertyName) + '"';

		result.values.push(property);
		return columnName + ' = $' + (i++);
	}).join(', ');

	return result;
};

Table.prototype.limitClause = function(limit) {
	return ((limit > 0) ? (' LIMIT ' + limit) : (''));
};

Table.prototype.alterStatement = function(addColumns, removeColumnNames) {
	return (
		'ALTER TABLE "' + this.name + '"\n' +
			Object.keys(addColumns || {}).map(function(columnName) {
				// TODO: if column is a reference, change it to a foreign key
				return '\t ADD COLUMN "' + columnName + '" ' + addColumns[columnName].join(' ');
			}).join(',\n') +
			(removeColumnNames || []).map(function(columnName) {
				return '\t DROP COLUMN "' + columnName + '"';
			}).join(',\n') +
		'\n;'
	);
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

Table.prototype.getName = function() {
	return ('"' + this.name + '"');
};

Table.prototype.createSelectStatement = function(whereMap, limit, sort) {
	var result = {
		query: '',
		values: []
	};

	result.query += 'SELECT * FROM ' + this.getName();

	var where = this.createWhereClause(whereMap);
	result.query += where.clause;
	result.values = result.values.concat(where.values);
	result.query += this.sortClause(sort);
	result.query += this.limitClause(limit);
	return result;
};

Table.prototype.createUpdateStatement = function(whereMap, setMap, limit) {
	var result = {
		query: '',
		values: []
	};

	result.query += 'UPDATE ' + this.getName();

	var set = this.createSetClause(setMap);
	result.query += set.clause;
	result.values = result.values.concat(set.values);

	var where = this.createWhereClause(whereMap, result.values.length + 1);
	result.query += where.clause;
	result.values = result.values.concat(where.values);

	// TODO: we want sorting here as well...
	//result.query += this.sortClause(sort);

	// We won't limit

	// TODO: this should be excluded in SQLite
	result.query += ' RETURNING *';
	return result;
};

Table.prototype.createInsertStatement = function(setMap) {
	var result = {
		query: '',
		values: []
	};

	result.query += 'INSERT INTO ' + this.getName();
	result.query += '(';
	result.query += Object.keys(setMap).map(function(propertyName) {
		var property = setMap[propertyName];
		var columnName = '"' + inflection.underscore(propertyName) + '"';

		if(property && typeof property.toQueryValue == 'function') {
			result.values.push(property.toQueryValue());
		}
		else {
			result.values.push(property);
		}

		return columnName;
	}).join(', ');
	result.query += ') VALUES (';

	result.query += Object.keys(setMap).map(function(propertyName, index) {
		return '$' + (index + 1);
	}).join(', ');

	result.query += ') ';
	result.query += 'RETURNING *';

	return result;
};

Table.prototype.dropStatement = function() {
	return 'DROP TABLE ' + this.getName();
};

Table.prototype.createDeleteStatement = function(whereMap) {
	var result = {
		query: '',
		values: []
	};

	result.query += 'DELETE FROM ' + this.getName();

	var where = this.createWhereClause(whereMap);
	result.query += where.clause;
	result.values = result.values.concat(where.values);
	return result;
};

Table.prototype.insert = function(setMap) {
	var result = this.createInsertStatement(setMap);
	return this.query(result.query, result.values);
};

Table.prototype.update = function(whereMap, setMap, limit) {
	var result = this.createUpdateStatement(whereMap, setMap, limit);

	return this.query(result.query, result.values);
};

Table.prototype.select = function(whereMap, limit, sort) {
	var result = this.createSelectStatement(whereMap, limit, sort);

	return this.query(result.query, result.values);
};

Table.prototype.remove = function(whereMap) {
	var result = this.createDeleteStatement(whereMap);
	return this.query(result.query, result.values);
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
	return this.query(this.existsStatement(), [this.name])
		.then(function(result) {
			return (result.rows.length > 0);
		});
};
