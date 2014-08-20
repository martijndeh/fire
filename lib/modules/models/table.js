'use strict';

exports = module.exports = Table;

var inflection = require('inflection');
var Q = require('q');

function quote(string) {
	return ('"' + string + '"');
}

/**
 * The table generates all SQL queries.
 *
 * @param {String} schemaName The name of the schema.
 * @param {Model} model      The model the table belongs to.
 * @param {Datastore} datastore  The datastore the app is connected to.
 */
function Table(schemaName, model, datastore) {
	if(!model) {
		throw new Error('Cannot create table with non-existing model.');
	}

	this.schemaName 	= schemaName;
	this.name			= inflection.tableize(model.getName());
	this.modelName 		= model.getName();
	this.model 			= model;
	this.datastore 		= datastore;
}

Table.keywords = {
	Text: 'TEXT',
	Integer: 'INTEGER',
	Boolean: 'BOOLEAN',
	Date: 'DATE',
	Timestamp: 'TIMESTAMP WITHOUT TIME ZONE',
	Time: 'TIME WITH TIME ZONE',
	Interval: 'INTERVAL',
	Unsigned: 'UNSIGNED',
	Serial: 'SERIAL',
	PrimaryKey: 'PRIMARY KEY',
	Unique: 'UNIQUE',
	NotNull: 'NOT NULL',
	Id: 'SERIAL PRIMARY KEY',
	UUID: 'UUID PRIMARY KEY DEFAULT uuid_generate_v4()',
	Default: function(defaultValue) {
		return 'DEFAULT ' + defaultValue;
	},
	References: function(tableName) {
		return 'REFERENCES ' + quote(tableName) + '(id)';
	}
};

/**
 * Executes a query with parameters against the datastore.
 *
 * @param  {String} query      The query to execute.
 * @param  {Array} parameters The parameters to pass to the query. The first item in the array is passed to $1, and so on.
 * @return {Promise}            [description]
 */
Table.prototype.query = function(query, parameters) {
	return this.datastore.query(query, parameters);
};

Table.prototype.parseSQLishFunction = function(sqlishFunctionName, firstArgument) {
	var targetProperty = this.getProperty(firstArgument);
	if(!targetProperty.isAssociation()) {
		throw new Error('Count only works on associations.');
	}

	var associatedColumn;
	var associatedTable;

	if(targetProperty.options.through) {
		associatedTable = targetProperty.options.through.getTable();
		associatedColumn = associatedTable.getProperty(this.getModelName()).columnName;
	}
	else {
		var associatedModel = targetProperty.getAssociatedModel();
		associatedTable = associatedModel.getTable();

		var associatedProperty = targetProperty.options.relationshipVia;
		associatedColumn = associatedProperty.columnName;
	}

	var sqlFunction = sqlishFunctionName.toUpperCase();

	return '(SELECT ' + sqlFunction + '(*) FROM ' + associatedTable.getName() + ' WHERE ' + this.getName() + '.id = ' + associatedTable.getName() + '.' + associatedColumn + ')';
};

Table.prototype.parseSQLishStatement = function(sqlish) {
	var self = this;
	var sql = sqlish.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, propertyNameOrFunction, p2, functionArgument) {
		if(functionArgument) {
			return self.parseSQLishFunction(propertyNameOrFunction, functionArgument);
		}
		else {
			// TODO: We also need to deal with column aliases
			var property = self.getProperty(propertyNameOrFunction);
			return property.columnName;
		}
	});

	return '(' + sql + ')';
};

Table.prototype.sortClause = function(sort) {
	var clause = '';
	if(sort) {
		clause += ' ORDER BY ';

		if(typeof sort == 'string') {
			clause += this.parseSQLishStatement(sort);
		}
		else {
			var self = this;
			clause += Object.keys(sort).map(function(propertyName) {
				var property = self.getProperty(propertyName);

				if(!property) {
					throw new Error('Warning: cannot find property `' + propertyName + '` in orderBy.');
				}

				var value = sort[propertyName];
				var sortValue = 'ASC';

				if(typeof value == 'string') {
					sortValue = value;
				}
				else {
					if(value < 0) {
						sortValue = 'DESC';
					}
					else {
						sortValue = 'ASC';
					}
				}

				return quote(property.columnName) + ' ' + sortValue;
			}).join(', ');
		}
	}

	return clause;
};

Table.prototype.getProperty = function(propertyName) {
	return this.model.getProperty(propertyName);
};

Table.prototype.getFirstProperty = function(keyPath) {
	var propertyNames = keyPath.split('.', 2);
	if(propertyNames.length > 1) {
		return this.getProperty(propertyNames[0]);
	}
	return null;
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

			var property = self.getProperty(propertyName);

			if(!property) {
				throw new Error('Cannot find property with name `' + propertyName + '` on table `' + self.name + '`. Did you specify an invalid property name in where clause?');
			}

			var whereValue = where[propertyName];
			var columnName;
			var firstProperty = self.getFirstProperty(propertyName);
			var valueResult;

			if(firstProperty) {
				valueResult = self.createValueClause(property.columnName, whereValue, i);
				valueResult.values.forEach(function(value) {
					result.values.push(value);
				});
				return 'EXISTS (SELECT * FROM ' + property.model.getTable().getName() + ' WHERE ' + valueResult.clause + ' AND ' + firstProperty.options.relationshipVia.columnName + ' = ' + self.getName() + '.id)';
			}
			else {
				if(property.isManyToMany()) {
					// Now we find the column name on the through relationship
					columnName = property.options.through.getTable().getName() + '.' +  quote(property.options.through.findAssociationsTo(property.options.relationshipVia.model)[0].columnName);
				}
				else if(property.options.hasOne) {
					var alias = quote(property.options.relationshipVia.model.getTable().name + '_' + property.name);
					columnName = alias + '.id';
				}
				else {
					if(firstProperty) {
						columnName = quote(property.model.getTable().name + '_' + firstProperty.name) + '.' + quote(property.columnName);
					}
					else {
						// If the property is not for this model, we need to find the correct alias.
						columnName = property.model.getTable().getName() + '.' + quote(property.columnName);
					}
				}

				valueResult = self.createValueClause(columnName, whereValue, i);
				i += valueResult.values.length;

				valueResult.values.forEach(function(value) {
					result.values.push(value);
				});

				return valueResult.clause;
			}
		}).join(' AND ');
	}

	return result;
};

Table.prototype.createValueClause = function(columnName, whereValue, i) {
	var result = {
		clause: '',
		values: []
	};

	if(whereValue === null) {
		result.clause = columnName + ' IS NULL';
	}
	else if(whereValue && typeof whereValue.toQueryValue == 'function') {
		result.values.push(whereValue.toQueryValue());
		result.clause = columnName + ' = $' + (i++);
	}
	else if(typeof whereValue == 'object' && !(whereValue instanceof Date)) {
		// If this is a reference property type, we need to check if we are matching the reference model e.g. {user:{name:'Test'}}

		result.clause = '(' + (Object.keys(whereValue).map(function(key) {
			var transformers = {
				$gte: '>=',
				$gt: '>',
				$lt: '<',
				$lte: '<=',
				$not: '!=',
				$like: 'LIKE'
			};

			if(!transformers[key]) {
				throw new Error('Invalid transformer `' + key + '`.');
			}

			if(whereValue[key] === null) {
				return columnName + ' IS NOT NULL';
			}
			else {
				result.values.push(whereValue[key]);
				return columnName + ' ' + transformers[key] + ' $' + (i++);
			}
		}).join(' AND ')) + ')';
	}
	else {
		result.values.push(whereValue);
		result.clause = columnName + ' = $' + (i++);
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

	var columns = [];
	Object.keys(setMap).forEach(function(propertyName) {
		var setValue = setMap[propertyName];
		var property = self.getProperty(propertyName);

		if(!property) {
			throw new Error('Could not find property `' + propertyName + '` in `' + self.name + '`.');
		}

		if(property.isAllowed()) {
			var columnName = quote(property.columnName);

			if(setValue && typeof setValue.toQueryValue == 'function') {
				result.values.push(setValue.toQueryValue());
			}
			else {
				result.values.push(setValue);
			}

			columns.push(columnName + ' = $' + (i++));
		}
	});

	result.clause += columns.join(', ');

	return result;
};

Table.prototype.limitClause = function(limit) {
	return ((limit > 0) ? (' LIMIT ' + limit) : (''));
};

Table.prototype.alter = function(addedProperties, removedProperties, changedProperties) {
	return this.query(this.alterStatement(addedProperties, removedProperties, changedProperties));
};

Table.prototype.alterStatement = function(addedProperties, removedProperties, changedProperties) {
	var clause = 'ALTER TABLE ' + this.getName() + '\n';

	var columns = [];
	(addedProperties || []).forEach(function(property) {
		if(property.isAllowed()) {
			columns.push('\t ADD COLUMN ' + quote(property.columnName) + ' ' + property.clauses.join(' '));
		}
	});
	(removedProperties || []).forEach(function(property) {
		if(property.isAllowed()) {
			columns.push('\t DROP COLUMN ' + quote(property.columnName));
		}
	});
	(changedProperties || []).forEach(function(property) {
		if(property.isAllowed()) {
			columns.push('\t ALTER COLUMN ' + quote(property.columnName) + ' TYPE ' + property.clauses[0] + ' SET ' + property.clauses.splice(1).join(' '));
		}
	});

	clause += columns.join(',\n');
	clause += '\n;';
	return clause;
};

Table.prototype.forEachProperty = function(callback) {
	var properties = this.model.getAllProperties();
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];
		callback(property);
	});
};

Table.prototype.forEachAssociation = function(callback) {
	var associations = this.model.getAssociations();
	Object.keys(associations).forEach(function(associationName) {
		var association = associations[associationName];
		callback(association);
	});
};

Table.prototype.createStatement = function() {
	var clause = 'CREATE TABLE ' + this.getName() + ' (\n';
	var columns = [];

	this.forEachProperty(function(property) {
		// If this is a many association we can ignore this property
		if(property.isAllowed()) {
			columns.push('\t' + quote(property.columnName) + ' ' + property.clauses.join(' '));
		}
	});

	clause += columns.join(',\n');
	clause += '\n);';
	return clause;
};

Table.prototype.getName = function() {
	return quote(this.name);
};

Table.prototype.getModelName = function() {
	return inflection.camelize(this.model.getName(), true);
};

Table.prototype.createReadOnlyStatement = function(property, targetPropertyName) {
	var targetProperty = property.model.getProperty(targetPropertyName);
	if(!targetProperty.isAssociation()) {
		throw new Error('Count only works on associations.');
	}

	var associatedColumn;
	var associatedTable;
	var table = property.model.getTable();

	if(targetProperty.options.through) {
		associatedTable = targetProperty.options.through.getTable();
		associatedColumn = inflection.camelize(property.model.getName(), true) + '_id';
	}
	else {
		var associatedModel = targetProperty.getAssociatedModel();
		associatedTable = associatedModel.getTable();

		var associatedProperty = targetProperty.options.relationshipVia;
		associatedColumn = associatedProperty.columnName;
	}

	return '(SELECT COUNT(*) FROM ' + associatedTable.getName() + ' WHERE ' + table.getName() + '.id = ' + associatedTable.getName() + '.' + associatedColumn + ')';
};

Table.prototype.selectClauseForAssociation = function(referenceProperty, parentAssociation) {
	var model = referenceProperty.getAssociatedModel();
	var properties = model.getAllProperties();

	var referenceTable = model.getTable();
	var alias = quote(referenceTable.name + '_' + referenceProperty.name);

	var self = this;
	var columns = [];
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.isAllowed()) {
			if(parentAssociation) {
				columns.push(alias + '.' + property.columnName + ' AS ' + quote(parentAssociation.name + property.columnNameIndicator + referenceProperty.name + property.columnNameIndicator + property.columnName));
			}
			else {
				columns.push(alias + '.' + property.columnName + ' AS ' + quote(referenceProperty.name + property.columnNameIndicator + property.columnName));
			}
		}
		else {
			// This is one terrible mess. Not DRY. Clean this up.

			if(property.options.counting && !property.options.readOnly) {
				property.options.readOnly = self.createReadOnlyStatement(property, property.options.counting);
			}

			if(property.options.readOnly && typeof property.options.readOnly == 'string') {
				var readOnly = property.options.readOnly.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, readOnlyPropertyName, p2, targetPropertyName) {
					if(targetPropertyName) {
						return self.createReadOnlyStatement(property, targetPropertyName);
					}
					else {
						return alias + '.' + inflection.underscore(readOnlyPropertyName);
					}
				});

				if(parentAssociation) {
					columns.push('(' + readOnly + ') AS ' + quote(parentAssociation.name + property.columnNameIndicator + referenceProperty.name + property.columnNameIndicator + property.columnName));
				}
				else {
					columns.push('(' + readOnly + ') AS ' + quote(referenceProperty.name + property.columnNameIndicator + property.columnName));
				}
			}
		}
	});

	return columns.join(', ');
};

Table.prototype.getJoinType = function(property) {
	if(property.options.required) {
		return 'INNER JOIN';
	}
	else {
		return 'LEFT OUTER JOIN';
	}
};

Table.prototype.createJoinStatement = function(association, parentAssociation) {
	var targetTableName, alias, associationProperty;

	if(parentAssociation) {
		targetTableName = quote(parentAssociation.getAssociatedModel().getTable().name + '_' + parentAssociation.name);
	}
	else {
		targetTableName = this.getName();
	}

	// Association is the property as defined in the model.
	if(association.isManyToMany()) {
		var associatedTable = association.options.through.getTable();

		var statement = '';

		var relation1Property = association.options.through.getProperty(inflection.camelize(association.model.getName(), true));
		var relation2Property = association.options.through.getProperty(inflection.camelize(association.getAssociatedModel().getName(), true));

		// TODO: Change this based on the Required property?
		statement += 'LEFT OUTER JOIN ' + associatedTable.getName() + ' ON (' + associatedTable.getName() + '.' + relation1Property.columnName + ' = ' + targetTableName + '.id)';

		alias = quote(association.getAssociatedModel().getTable().name + '_' + association.name);

		statement += 'LEFT OUTER JOIN ' + association.getAssociatedModel().getTable().getName() + ' AS ' + alias + ' ON (' + associatedTable.getName() + '.' + relation2Property.columnName + ' = ' + alias + '.id)';

		return statement;
	}
	else {
		var referenceTableName = association.getAssociatedModel().getTable().getName();
		alias = quote(association.getAssociatedModel().getTable().name + '_' + association.name);

		if(association.options.hasOne) {
			// hasOne is actually the reverse of belongsTo
			associationProperty = association.getAssociatedModel().getProperty(association.options.hasOne);

			return this.getJoinType(association) + ' ' + referenceTableName + ' AS ' + alias + ' ON (' + targetTableName + '.id = ' + alias + '.' + associationProperty.columnName + ')';
		}
		else if(association.options.hasMany) {
			associationProperty = association.getAssociatedModel().getProperty(association.options.hasMany);

			if(!associationProperty) {
				throw new Error('Could not find association property `' + association.options.hasMany + '` on `' + association.model.getName() + '`.');
			}

			return this.getJoinType(association) + ' ' + referenceTableName + ' AS ' + alias + ' ON (' + targetTableName + '.' + 'id' + ' = ' + alias + '.' + associationProperty.columnName + ')';
		}
		else if(association.options.belongsTo) {
			return this.getJoinType(association) + ' ' + referenceTableName + ' AS ' + alias + ' ON (' + targetTableName + '.' + association.columnName + ' = ' + alias + '.id)';
		}
		else if(association.options.autoFetch) {
			throw new Error('Unknown association type in `' + association.name + '`.');
		}
		else {
			// No auto fetch
			// Nothing we want to do here
		}
	}
};

Table.prototype.getAssociations = function() {
	return this.model.getAllAssociations();
};

Table.prototype.getAssociation = function(associationName) {
	return this.model.getAssociation(associationName);
};

Table.prototype.createSelectStatement = function(whereMap, limit, sort, select) {
	var result = {
		query: '',
		values: []
	};

	var self = this;

	var tableName = this.getName();

	var where = this.createWhereClause(whereMap);
	var limitClause = this.limitClause(limit);

	var columns = [];

	this.forEachProperty(function(property) {
		if(!select || select.length === 0 || property.name == 'id' || select.indexOf(property.name) >= 0) {
			if(property.isAllowed()) {
				columns.push(tableName + '.' + property.columnName);
			}
			else {
				// This really needs some re-work. It's not DRY. It's too complex even with comments.
				if(property.options.counting && !property.options.readOnly) {
					property.options.readOnly = self.createReadOnlyStatement(property, property.options.counting);
				}

				if(property.options.readOnly && typeof property.options.readOnly == 'string') {
					// Convert property names to column names.
					var readOnly = property.options.readOnly.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, readOnlyPropertyName, p2, targetPropertyName) {
						if(targetPropertyName) {
							return self.createReadOnlyStatement(property, targetPropertyName);
						}
						else {
							return inflection.underscore(readOnlyPropertyName);
						}
					});

					columns.push('(' + readOnly + ') AS ' + quote(property.columnName));
				}
			}
		}
	});

	var childAssociations = {};

	var associationNames = Object.keys(this.getAssociations());

	if(associationNames.length > 0) {
		if(!sort && this.getProperty('id')) {
			sort = {
				id: 'ASC'
			};
		}
	}

	this.forEachAssociation(function(association) {
		if(association.options.autoFetch) {
			columns.push(self.selectClauseForAssociation(association));

			var associatedModel = association.getAssociatedModel();
			if(associatedModel) {
				var parentName = association.name;

				var associations = associatedModel.getAssociations();
				Object.keys(associations).forEach(function(associationName) {
					var childAssociation = associations[associationName];
					if(childAssociation.options.autoFetch) {
						if(!childAssociations[parentName]) {
							childAssociations[parentName] = [];
						}

						childAssociations[parentName].push(childAssociation);
					}
				});
			}
		}
	});

	Object.keys(childAssociations).forEach(function(parentName) {
		var parentAssociation = self.getAssociation(parentName);

		childAssociations[parentName].forEach(function(association) {
			columns.push(self.selectClauseForAssociation(association, parentAssociation));
		});
	});

	var whereJoinStatements = [];
	var joinStatements = [];

	this.forEachAssociation(function(association) {
		if(association.options.autoFetch) {
			joinStatements.push(self.createJoinStatement(association));
		}

		if(whereMap[association.name]) {
			whereJoinStatements.push(self.createJoinStatement(association));
		}
	});

	Object.keys(childAssociations).forEach(function(parentName) {
		var parentAssociation = self.getAssociation(parentName);

		childAssociations[parentName].forEach(function(association) {
			if(association.options.autoFetch) {
				joinStatements.push(self.createJoinStatement(association, parentAssociation));
			}

			if(whereMap[association.name]) {
				whereJoinStatements.push(self.createJoinStatement(association, parentAssociation));
			}
		});
	});

	var sortClause = this.sortClause(sort);

	if(limit) {
		result.query += 'WITH ' + tableName + ' AS (SELECT ' + tableName + '.* FROM ' + tableName + ' ';

		result.query += whereJoinStatements.join(' ');
		whereJoinStatements = null;

		if(where) {
			result.query += where.clause;
			result.values = result.values.concat(where.values);

			where = null;
		}

		result.query += sortClause;
		result.query += limitClause + ') ';

		limitClause = null;
	}

	result.query += 'SELECT ';
	result.query += columns.join(', ');
	result.query += ' FROM ' + this.getName();

	result.query += joinStatements.join(' ');

	if(whereJoinStatements) {
		result.query += whereJoinStatements.join(' ');
	}

	if(where) {
		result.query += where.clause;
		result.values = result.values.concat(where.values);
	}

	if(sortClause) {
		result.query += sortClause;
	}

	if(limitClause) {
		result.query += limitClause;
	}

	return result;
};

Table.prototype.createUpdateStatement = function(whereMap, setMap) {
	var result = {
		query: '',
		values: []
	};

	result.query += 'UPDATE ' + this.getName() + ' ';

	var set = this.createSetClause(setMap);
	result.query += set.clause;
	result.values = result.values.concat(set.values);

	var where = this.createWhereClause(whereMap, result.values.length + 1);
	result.query += where.clause;
	result.values = result.values.concat(where.values);

	// TODO: we want sorting here as well...
	//result.query += this.sortClause(sort);

	// We won't limit

	result.query += ' ' + this.createReturningStatement();
	return result;
};

Table.prototype.createInsertStatement = function(setMap) {
	var result = {
		query: '',
		values: []
	};

	var self = this;

	result.query += 'INSERT INTO ' + this.getName() + ' ';


	var columns = [];
	Object.keys(setMap).forEach(function(propertyName) {
		var setValue = setMap[propertyName];
		var property = self.getProperty(propertyName);

		if(!property) {
			throw new Error('Could not find property `' + propertyName + '` in `' + self.name + '`.');
		}

		if(property.isAllowed()) {
			var columnName = quote(property.columnName);

			if(setValue && typeof setValue.toQueryValue == 'function') {
				result.values.push(setValue.toQueryValue());
			}
			else {
				result.values.push(setValue);
			}

			columns.push(columnName);
		}
	});

	if(columns.length > 0) {
		result.query += '(';
		result.query += columns.join(', ');
		result.query += ') VALUES (';

		result.query += columns.map(function(description, index) {
			return '$' + (index + 1);
		}).join(', ');

		result.query += ') ';
	}
	else {
		// We cannot omit this, if there are no columns, else postgres throws an error.
		result.query += 'DEFAULT VALUES ';
	}

	result.query += this.createReturningStatement();
	return result;
};

Table.prototype.createReturningStatement = function() {
	var returning = 'RETURNING *';

	var readOnlyProperties = [];
	var self = this;
	this.forEachProperty(function(property) {
		if(property.options.counting && !property.options.readOnly) {
			property.options.readOnly = self.createReadOnlyStatement(property, property.options.counting);
		}

		// If this is a many association we can ignore this property
		if(property.options.readOnly && typeof property.options.readOnly == 'string') {
			var readOnly = property.options.readOnly.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, readOnlyPropertyName, p2, targetPropertyName) {
				if(targetPropertyName) {
					return self.createReadOnlyStatement(property, targetPropertyName);
				}
				else {
					return inflection.underscore(readOnlyPropertyName);
				}
			});

			readOnlyProperties.push('(' + readOnly + ') AS ' + quote(property.columnName));
		}
	});

	if(readOnlyProperties.length > 0) {
		returning += ', ' + readOnlyProperties.join(', ');
	}

	return returning;
};

Table.prototype.dropStatement = function(cascade) {
	var clause = 'DROP TABLE ' + this.getName();

	if(cascade) {
		clause += ' CASCADE';
	}

	return clause;
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

Table.prototype.select = function(whereMap, limit, sort, select) {
	var result = this.createSelectStatement(whereMap, limit, sort, select);

	return this.query(result.query, result.values);
};

Table.prototype.remove = function(whereMap) {
	var result = this.createDeleteStatement(whereMap);
	return this.query(result.query, result.values);
};

Table.prototype.createSchema = function() {
	if(this.schemaName) {
		return this.query('CREATE SCHEMA IF NOT EXISTS ' + this.schemaName);
	}

	return Q.when(true);
};

Table.prototype.create = function() {
	var self = this;
	return this.createSchema()
		.then(function() {
			return self.query(self.createStatement());
		});
};

Table.prototype.drop = function(cascade) {
	return this.query(this.dropStatement(cascade));
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
