'use strict';

var debug = require('debug')('fire:sql');

exports = module.exports = Table;

var inflection = require('inflection');
var Property = require('./property');

function Table(name, properties, datastore) {
	this.name 		= inflection.tableize(name);
	this.properties = {};
	this._datastore = datastore;
	this.autoFetch = {};

	this.addProperties(properties, false);
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

	AutoFetch: function() {
		return function(property) {
			property.autoFetch = true;
		}
	},

	Default: function(defaultValue) {
		return 'DEFAULT ' + defaultValue;
	},
	Reference: function(modelNameOrModel) {
		return function(property) {
			property.columnName = property.columnName + '_id';

			if(typeof modelNameOrModel == 'string') {
				property.referenceName = modelNameOrModel;
			}
			else {
				property.referenceName = modelNameOrModel.getName();
			}

			return 'INTEGER REFERENCES ' + property.getReference().getTable().getName() + '(id)';
		}
	},
	SelfReference: function() {
		return function(property) {
			return Table.propertyTypes.Reference(property.columnName);
		};
	}
};

Table.prototype.addProperties = function(properties, alterTable) {
	var self = this;
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];
		self.addProperty(property);
	});

	if(alterTable) {
		return this.query(this.alterStatement(properties));
	}
};

Table.prototype.removeProperties = function(propertyNames, alterTable) {
	var removedProperties = [];

	// Now, figure out all the column names we want to remove
	// To calculate the column name we need to property types as well

	var self = this;
	propertyNames.forEach(function(propertyName) {
		var property = self.properties[propertyName];

		if(property.autoFetch) {
			delete self.autoFetch[property.name];
		}

		removedProperties.push(property);
		delete self.properties[propertyName];
	});

	if(alterTable) {
		return this.query(this.alterStatement(null, removedProperties));
	}
};

Table.prototype.addProperty = function(property) {
	if(this.properties[property.name]) {
		throw new Error('Duplicate property `' + property.name + '` in `' + this.name + '`.');
	}

	if(property.autoFetch) {
		this.autoFetch[property.name] = property;
	}

	this.properties[property.name] = property;
};

Table.prototype.query = function(query, parameters) {
	debug('Table#query %s (%s)', query, JSON.stringify(parameters));
	return this._datastore.query(query, parameters);
};

Table.prototype.sortClause = function(sort) {
	if(sort) {
		var self = this;
		return ' ORDER BY ' +
			Object.keys(sort).map(function(propertyName) {
				var property = self.properties[propertyName];
				var sortValue = sort[propertyName];

				return '"' + property.columnName + '" ' + sortValue;
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

		var self = this;
		// TODO: how do we want to specify do OR's?
		result.clause += propertyNames.map(function(propertyName) {
			var property = self.properties[propertyName];
			var whereValue = where[propertyName];
			var columnName = self.getName() + '."' + property.columnName + '"';

			if(whereValue === null) {
				return columnName + ' IS NULL';
			}
			else if(whereValue && typeof whereValue.toQueryValue == 'function') {
				result.values.push(whereValue.toQueryValue());
				return columnName + ' = $' + (i++);
			}
			else if(typeof whereValue == 'object' && !(whereValue instanceof Date)) {
				// If this is a reference property type, we need to check if we are matching the reference model e.g. {user:{name:'Test'}}

				return '(' + (Object.keys(whereValue).map(function(key) {
					var transformers = {
						$gte: '>=',
						$gt: '>',
						$lt: '<',
						$lte: '<='
					};

					if(!transformers[key]) {
						throw new Error('Invalid transformer `' + key + '`.');
					}

					result.values.push(whereValue[key]);
					return columnName + ' ' + transformers[key] + ' $' + (i++);
				}).join(' AND ')) + ')';
			}
			else {
				result.values.push(whereValue);
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
	var self = this;

	result.clause += 'SET ';
	result.clause += Object.keys(setMap).map(function(propertyName) {
		var setValue = setMap[propertyName];
		var property = self.properties[propertyName];
		var columnName = '"' + property.columnName + '"';

		result.values.push(setValue);
		return columnName + ' = $' + (i++);
	}).join(', ');

	return result;
};

Table.prototype.limitClause = function(limit) {
	return ((limit > 0) ? (' LIMIT ' + limit) : (''));
};

Table.prototype.alterStatement = function(addedPropertiesMap, removedProperties) {
	return (
		'ALTER TABLE "' + this.name + '"\n' +
			Object.keys(addedPropertiesMap || {}).map(function(propertyName) {
				var property = addedPropertiesMap[propertyName];
				return '\t ADD COLUMN "' + property.columnName + '" ' + property.clauses.join(' ');
			}).join(',\n') +
			(removedProperties || []).map(function(property) {
				return '\t DROP COLUMN "' + property.columnName + '"';
			}).join(',\n') +
		'\n;'
	);
};

Table.prototype.createStatement = function() {
	var self = this;
	return (
		'CREATE TABLE "' + this.name + '" (\n' +
			Object.keys(this.properties).map(function(propertyName) {
				var property = self.properties[propertyName];

				return '\t"' + property.columnName + '" ' + property.clauses.join(' ');
			}).join(',\n') +
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

	var self = this;

	result.query += 'SELECT ';

	// Create the select clause based on all properties AND auto fetches
	var tableName = this.getName();
	result.query += Object.keys(this.properties).map(function(propertyName) {
		var property = self.properties[propertyName];

		return tableName + '.' + property.columnName;
	}).concat(Object.keys(this.autoFetch).map(function(autoFetchName) {
		// Now loop over all property from autoFetch.reference
		var autoFetch = self.autoFetch[autoFetchName];

		var reference = autoFetch.getReference();
		var properties = reference.getAllProperties();
		var referenceTableName = reference.getTable().getName();
		return Object.keys(properties).map(function(propertyName) {
			var property = properties[propertyName];

			return referenceTableName + '.' + property.columnName + ' AS ' + property.columnNameIndicator + autoFetch.name + property.columnNameIndicator + property.columnName;
		}).join(', ');
	})).join(', ');

	result.query += ' FROM ' + this.getName();

	// Create the join clause based on autoFetches
	result.query += Object.keys(this.autoFetch).map(function(propertyName) {
		var autoFetch = self.autoFetch[propertyName];

		var referenceTableName = autoFetch.getReference().getTable().getName();
		return ' INNER JOIN ' + referenceTableName + ' ON (' + tableName + '.' + autoFetch.columnName + ' = ' + referenceTableName + '.id)';
	}).join('');

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

	var self = this;

	result.query += 'INSERT INTO ' + this.getName();
	result.query += '(';
	result.query += Object.keys(setMap).map(function(propertyName) {
		var setValue = setMap[propertyName];
		var property = self.properties[propertyName];
		var columnName = '"' + property.columnName + '"';

		if(setValue && typeof setValue.toQueryValue == 'function') {
			result.values.push(setValue.toQueryValue());
		}
		else {
			result.values.push(setValue);
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
