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
 * @constructor
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
	// TODO: This should be split in several keywords.
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
		associatedColumn = associatedTable.getProperty(targetProperty.options.throughPropertyName).columnName;
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

Table.prototype.execute = function(sql, values) {
	var statement = this.parseSQLishStatement(sql);
	return this.query(statement.substring(1, statement.length - 1), values);
};

Table.prototype.parseSQLishStatement = function(sqlish) {
	var self = this;
	var sql = sqlish.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, propertyNameOrFunction, p2, functionArgument) {
		if(functionArgument) {
			return self.parseSQLishFunction(propertyNameOrFunction, functionArgument);
		}
		else {
			if(propertyNameOrFunction.match(/^[0-9]+$/)) {
				return '$' + propertyNameOrFunction;
			}
			else {
				// TODO: We also need to deal with column aliases
				var property = self.getProperty(propertyNameOrFunction);
				return property.columnName;
			}
		}
	});

	return '(' + sql + ')';
};

Table.prototype.groupClause = function(groupColumns) {
	var clause = '';
	if(groupColumns && groupColumns.length) {
		clause += ' GROUP BY ';
		clause += groupColumns.join(', ');
	}

	return clause;
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

				var sorting = quote(property.columnName) + ' ' + sortValue;

				if(property.options.isVirtual) {
					return sorting;
				}
				else {
					return self.getName() + '.' + sorting;
				}
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
				i += valueResult.values.length;

				valueResult.values.forEach(function(value) {
					result.values.push(value);
				});

				var statements = [];
				statements.push('EXISTS (SELECT * FROM ' + property.model.getTable().getName() + ' WHERE ' + valueResult.clause + ' AND ');

				if(firstProperty.isManyToMany()) {
					var otherProperty = firstProperty.options.through.getProperty(firstProperty.options.throughPropertyName);
					statements.push(otherProperty.columnName + ' = ' + self.getName() + '.id)');
				}
				else {
					if(firstProperty.options.relationshipVia.isAllowed()) {
						statements.push(firstProperty.options.relationshipVia.columnName + ' = ' + self.getName() + '.id)');
					}
					else {
						statements.push(self.getName() + '.' + firstProperty.columnName + ' = ' + property.model.getTable().getName() + '.id)');
					}
				}

				return statements.join('');
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

		var transformers = {
			$is: ['=', 'IS'],
			$gte: ['>='],
			$gt: ['>'],
			$lt: ['<'],
			$lte: ['<='],
			$not: ['!=', 'IS NOT'],
			$like: ['LIKE'],
			$regex: ['~']
		};

		result.clause = '(' + (Object.keys(whereValue).map(function(key) {
			var transformer = transformers[key];
			if(!transformer) {
				throw new Error('Invalid transformer `' + key + '`.');
			}

			if(whereValue[key] === null) {
				if(transformer.length <= 1) {
					throw new Error('Cannot use transformer `' + key + '` with NULL value.');
				}
				else {
					return columnName + ' ' + transformer[1] + ' NULL';
				}
			}
			else {
				result.values.push(whereValue[key]);
				return columnName + ' ' + transformer[0] + ' $' + (i++);
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
				columns.push(columnName + ' = $' + (i++));
			}
			else if(setValue !== null && typeof setValue == 'object' && !(setValue instanceof Date)) {
				var transformers = {
					$inc: '+=',
					$mul: '*=',
					$div: '/=',
					$set: '='
				};

				// TODO: what if this is e.g. {id: uuid} and this is an association. Should we just get the id and use it?

				Object.keys(setValue).forEach(function(key) {
					var transformer = transformers[key];
					if(!transformer) {
						throw new Error('Invalid transformer `' + key + '`.');
					}

					result.values.push(setValue[key]);
					columns.push(columnName + ' ' + transformer + ' $' + (i++));
				});
			}
			else {
				result.values.push(setValue);
				columns.push(columnName + ' = $' + (i++));
			}


		}
	});

	result.clause += columns.join(', ');

	return result;
};

Table.prototype.limitClause = function(limit) {
	return ((limit > 0) ? (' LIMIT ' + limit) : (''));
};

Table.prototype.offsetClause = function(offset) {
	return ((offset > 0) ? (' OFFSET ' + offset) : (''));
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
		associatedColumn = associatedTable.getProperty(targetProperty.options.throughPropertyName).columnName;
	}
	else {
		var associatedModel = targetProperty.getAssociatedModel();
		associatedTable = associatedModel.getTable();

		var associatedProperty = targetProperty.options.relationshipVia;
		associatedColumn = associatedProperty.columnName;
	}

	return '(SELECT COUNT(*) FROM ' + associatedTable.getName() + ' WHERE ' + table.getName() + '.id = ' + associatedTable.getName() + '.' + associatedColumn + ')';
};

Table.prototype.selectColumnsForAssociation = function(referenceProperty, parentAssociation, select) {
	var model = referenceProperty.getAssociatedModel();
	var properties = model.getAllProperties();

	var startSelect = '';
	if(parentAssociation) {
		startSelect += parentAssociation.name + '.';
	}
	startSelect += referenceProperty.name + '.';

	var selectProperties = [];
	var selectAllProperties = false;
	var selectIsArray = Array.isArray(select);

	if(selectIsArray) {
		select.forEach(function(selectProperty) {
			if(selectProperty.indexOf(startSelect) === 0) {
				var propertyName = selectProperty.substring(startSelect.length);

				if(propertyName == '*') {
					selectAllProperties = true;
				}
				else {
					selectProperties.push(propertyName);
				}
			}
		});
	}

	var referenceTable = model.getTable();
	var alias = quote(referenceTable.name + '_' + referenceProperty.name);

	var self = this;
	var columns = [];
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(!selectIsArray || selectAllProperties || propertyName == 'id' || selectProperties.indexOf(propertyName) >= 0) {
			if(property.isAllowed()) {
				if(parentAssociation) {
					columns.push([alias + '.' + property.columnName, quote(parentAssociation.name + property.columnNameIndicator + referenceProperty.name + property.columnNameIndicator + property.columnName)]);
				}
				else {
					columns.push([alias + '.' + property.columnName, quote(referenceProperty.name + property.columnNameIndicator + property.columnName)]);
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
						columns.push(['(' + readOnly + ')', quote(parentAssociation.name + property.columnNameIndicator + referenceProperty.name + property.columnNameIndicator + property.columnName)]);
					}
					else {
						columns.push(['(' + readOnly + ')', quote(referenceProperty.name + property.columnNameIndicator + property.columnName)]);
					}
				}
			}
		}
	});

	return columns;
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

		var relation1Property = association.options.through.getProperty(association.options.throughPropertyName);
		var relation2Property = association.options.through.getProperty(association.options.relationshipVia.options.throughPropertyName);

		if(!relation1Property) {
			throw new Error('Could not find property `' + inflection.camelize(association.model.getName(), true) + '` on `' + association.options.through.getName() + '`.');
		}

		if(!relation2Property) {
			throw new Error('Could not find property `' + inflection.camelize(association.getAssociatedModel().getName(), true) + '` on `' + association.options.through.getName() + '`.');
		}

		// TODO: Create a unique alias for associatedTable.getName().

		// TODO: Change this based on the Required property?
		statement += ' LEFT OUTER JOIN ' + associatedTable.getName() + ' ON (' + associatedTable.getName() + '.' + relation1Property.columnName + ' = ' + targetTableName + '.id)';


		alias = quote(association.getAssociatedModel().getTable().name + '_' + association.name);

		statement += ' LEFT OUTER JOIN ' + association.getAssociatedModel().getTable().getName() + ' AS ' + alias + ' ON (' + associatedTable.getName() + '.' + relation2Property.columnName + ' = ' + alias + '.id)';

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

Table.prototype.createSelectStatement = function(whereMap, limit, skip, sort, group, select, fetchAssociations) {
	var result = {
		query: '',
		values: []
	};

	var self = this;

	var tableName = this.getName();

	var where = this.createWhereClause(whereMap);

	var limitClause = this.limitClause(limit);
	var offsetClause = this.offsetClause(skip);

	var columns = [];
	var selectIsArray = Array.isArray(select);

	var groupColumns = null;

	if(group) {
		if(typeof group == 'string') {
			groupColumns = [tableName + '.' + this.getProperty(group).columnName];
		}
		else {
			groupColumns = group.map(function(key) {
				var p = self.getProperty(key);
				return tableName + '.' + p.columnName;
			});
		}
	}

	this.forEachProperty(function(property) {
		if(!selectIsArray || property.name == 'id' && !group || select.indexOf(property.name) >= 0) {
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
		// TODO: Remove this sort clause. We're not using a SERIAL id as PRIMARY KEY anymore.
		// We don't want an implicit sorting when we are grouping.
		if(!sort && this.getProperty('id') && !group) {
			sort = {
				id: 'ASC'
			};
		}
	}

	this.forEachAssociation(function(association) {
		if(association.options.autoFetch || fetchAssociations && fetchAssociations.indexOf(association.name) >= 0) {
			var selectColumns = self.selectColumnsForAssociation(association, null, select);

			selectColumns.forEach(function(columnType) {
				if(groupColumns) {
					groupColumns.push(columnType[0]);
				}

				columns.push(columnType[0] + ' AS ' + columnType[1]);
			});

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
			var selectColumns = self.selectColumnsForAssociation(association, parentAssociation, select);
			selectColumns.forEach(function(columnType) {
				if(groupColumns) {
					groupColumns.push(columnType[0]);
				}

				columns.push(columnType[0] + ' AS ' + columnType[1]);
			});
		});
	});

	var whereJoinStatements = [];
	var joinStatements = [];

	var usingCTE = (limit || skip);

	this.forEachAssociation(function(association) {
		// If we are using a CTE, we can use the where join statements in addition to the join statements
		// But if we are not using a CTE, we cannot use them both as we'll specify the given table more than once
		if(usingCTE) {
			if(whereMap[association.name]) {
				whereJoinStatements.push(self.createJoinStatement(association));
			}

			if(association.options.autoFetch || fetchAssociations && fetchAssociations.indexOf(association.name) >= 0) {
				joinStatements.push(self.createJoinStatement(association));
			}
		}
		else {
			if(whereMap[association.name] || association.options.autoFetch || fetchAssociations && fetchAssociations.indexOf(association.name) >= 0) {
				joinStatements.push(self.createJoinStatement(association));
			}
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

	if(usingCTE) {
		result.query += 'WITH ' + tableName + ' AS (SELECT ' + tableName + '.* FROM ' + tableName + ' ';

		result.query += whereJoinStatements.join(' ');
		whereJoinStatements = null;

		if(where) {
			result.query += where.clause;
			result.values = result.values.concat(where.values);

			where = null;
		}

		result.query += sortClause;

		result.query += limitClause;
		result.query += offsetClause;

		result.query += ') ';

		// TODO: Should we set the sortClause to null as well?
		//sortClause = null;

		limitClause = null;
		offsetClause = null;
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

	if(groupColumns) {
		var groupClause = this.groupClause(groupColumns);
		result.query += groupClause;
	}

	if(sortClause) {
		result.query += sortClause;
	}

	if(limitClause) {
		result.query += limitClause;
	}

	if(offsetClause) {
		result.query += offsetClause;
	}

	return result;
};

Table.prototype.createDeleteStatement = function(whereMap, limit, skip, sort) {
	var result = {
		query: '',
		values: []
	};

	var tableName = this.getName();
	var where;

	if(limit || skip || sort) {
		result.query += 'WITH t AS (SELECT ' + tableName + '.* FROM ' + tableName + ' ';

		where = this.createWhereClause(whereMap, result.values.length + 1);
		result.query += where.clause;
		result.values = result.values.concat(where.values);

		result.query += this.sortClause(sort);
		result.query += this.limitClause(limit);
		result.query += this.offsetClause(skip);

		result.query += ') ';
	}

	result.query += 'DELETE FROM ' + tableName;

	if(!(limit || skip || sort)) {
		where = this.createWhereClause(whereMap, result.values.length + 1);
		result.query += where.clause;
		result.values = result.values.concat(where.values);
	}
	else {
		result.query += ' WHERE id IN (SELECT id FROM t)';
	}

	result.query += ' ' + this.createReturningStatement();
	return result;
};

Table.prototype.createUpdateStatement = function(whereMap, setMap, limit, skip, sort) {
	var result = {
		query: '',
		values: []
	};

	var tableName = this.getName();
	var where;

	if(limit || skip || sort) {
		result.query += 'WITH t AS (SELECT ' + tableName + '.* FROM ' + tableName + ' ';

		where = this.createWhereClause(whereMap, result.values.length + 1);
		result.query += where.clause;
		result.values = result.values.concat(where.values);

		result.query += this.sortClause(sort);
		result.query += this.limitClause(limit);
		result.query += this.offsetClause(skip);

		result.query += ') ';
	}

	result.query += 'UPDATE ' + tableName + ' ';

	var set = this.createSetClause(setMap, result.values.length + 1);
	result.values = result.values.concat(set.values);
	result.query += set.clause;

	if(!(limit || skip || sort)) {
		where = this.createWhereClause(whereMap, result.values.length + 1);
		result.query += where.clause;
		result.values = result.values.concat(where.values);
	}
	else {
		result.query += ' WHERE id IN (SELECT id FROM t)';
	}

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

Table.prototype.insert = function(setMap) {
	var result = this.createInsertStatement(setMap);
	return this.query(result.query, result.values);
};

Table.prototype.update = function(whereMap, setMap, limit, skip, sort) {
	var result = this.createUpdateStatement(whereMap, setMap, limit, skip, sort);

	return this.query(result.query, result.values);
};

Table.prototype.select = function(whereMap, limit, skip, sort, group, select, associations) {
	var result = this.createSelectStatement(whereMap, limit, skip, sort, group, select, associations);

	return this.query(result.query, result.values);
};

Table.prototype.remove = function(whereMap, limit, skip, sort) {
	var result = this.createDeleteStatement(whereMap, limit, skip, sort);
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
