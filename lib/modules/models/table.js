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
	this.knex 			= datastore.knex;
}

Table.keywords = {
	Text: 'TEXT',
	Integer: 'INTEGER',
	Decimal: function(precision, scale) {
		if(typeof precision != 'undefined' && typeof scale != 'undefined') {
			return 'DECIMAL(' + precision + ', ' + scale + ')';
		}
		else if(typeof precision != 'undefined' && typeof scale == 'undefined') {
			return 'DECIMAL(' + precision + ')';
		}

		return 'DECIMAL';
	},
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
	UUIDType: 'UUID',
	Default: function(defaultValue) {
		return 'DEFAULT ' + defaultValue;
	},
	References: function(tableName) {
		return 'REFERENCES ' + quote(tableName) + '(id)';
	}
};

/**
 * Executes a knex query.
 *
 * @param  {String} query      The query to execute.
 * @param  {Array} parameters The parameters to pass to the query. The first item in the array is passed to $1, and so on.
 * @return {Promise}            [description]
 */
Table.prototype.query = function(query) {
	return this.datastore.query(query);
};

Table.prototype.rawQuery = function(query, parameters) {
	return this.datastore.rawQuery(query, parameters);
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

	// Is this working with $1 instead of ? values?
	var query = this.knex.raw(statement.substring(1, statement.length - 1), values);

	return this.query(query);
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

Table.prototype.addSetClause = function(query, setMap) {
	if(setMap) {
		var updateMap = {};
		var transformers = {
			$inc: function(q, column, value) {
				return q.increment(column, value);
			},
			//$mul: '*=',
			//$div: '/=',
			//$set: '=',
			$decr: function(q, column, value) {
				return q.decrement(column, value);
			}
		};

		var self = this;
		Object.keys(setMap).forEach(function(propertyName) {
			var setValue = setMap[propertyName];
			var property = self.getProperty(propertyName);

			if(!property) {
				throw new Error('Could not find property `' + propertyName + '` in `' + self.name + '`.');
			}

			if(property.isAllowed()) {
				var columnName = property.columnName;

				if(setValue && typeof setValue.toQueryValue == 'function') {
					updateMap[columnName] = setValue.toQueryValue();
				}
				else if(setValue !== null && typeof setValue == 'object' && !(setValue instanceof Date)) {
					Object.keys(setValue).forEach(function(key) {
						var transformer = transformers[key];
						if(!transformer) {
							throw new Error('Invalid transformer `' + key + '`.');
						}

						query = transformer(query, columnName, setValue[key]);
					});
				}
				else {
					updateMap[columnName] = setValue;
				}
			}
		});

		query = query.update(updateMap);
	}

	return query;
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

	return this.knex.raw(clause);
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
	return this.knex.raw(clause);
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

Table.prototype.getAssociations = function() {
	return this.model.getAllAssociations();
};

Table.prototype.getAssociation = function(associationName) {
	return this.model.getAssociation(associationName);
};

Table.prototype.addJoinStatement = function(query, associations) {
	var parentAssociation = null;
	var self = this;
	var association = associations[associations.length - 1];

	if(associations.length > 1) {
		parentAssociation = associations[associations.length - 2];
	}

	var targetTableName, alias, associationProperty;

	targetTableName = associations.map(function(a) {
		return a.name;
	}).join('_');

	var previousAlias = [self].concat(associations.slice(0, -1)).map(function(a) {
		return a.name;
	}).join('_');

	alias = self.name + '_' + associations.map(function(a) {
		return a.name;
	}).join('_');

	var referenceTableName = association.getAssociatedModel().getTable().name;
	var joinType = association.options.required ? 'innerJoin' : 'leftOuterJoin';

	if(association.options.hasOne) {
		// hasOne is actually the reverse of belongsTo
		associationProperty = association.getAssociatedModel().getProperty(association.options.hasOne);

		// required -> innerJoin... else -> leftOuterJoin

		query = query[joinType](referenceTableName + ' as ' + alias, previousAlias + '.id', alias + '.' + associationProperty.columnName);
	}
	else if(association.options.hasMany) {
		associationProperty = association.getAssociatedModel().getProperty(association.options.hasMany);

		if(!associationProperty) {
			throw new Error('Could not find association property `' + association.options.hasMany + '` on `' + association.model.getName() + '`.');
		}

		query = query[joinType](referenceTableName + ' as ' + alias, previousAlias + '.' + 'id', alias + '.' + associationProperty.columnName);
	}
	else if(association.options.belongsTo) {
		//query = query[joinType](referenceTableName + ' as ' + alias, targetTableName + '.' + association.columnName, alias + '.id');
		query = query[joinType](referenceTableName + ' as ' + alias, previousAlias + '.' + association.columnName, alias + '.id');
	}
	else if(association.options.autoFetch) {
		throw new Error('Unknown association type in `' + association.name + '`.');
	}
	else {
		// No auto fetch
		// Nothing we want to do here
	}

	return query;
};

Table.prototype.addAssociation = function(query, associations, select, autoFetchDepth) {
	var self = this;
	var lastAssociation = associations[associations.length - 1];

	query = self.addSelectColumnsForAssociation(query, associations, select);
	query = self.addJoinStatement(query, associations);

	if(associations.length < autoFetchDepth) {
		var associatedModel = lastAssociation.getAssociatedModel();
		if(associatedModel) {
			var childAssociations = associatedModel.getAssociations();
			Object.keys(childAssociations).forEach(function(associationName) {
				var childAssociation = childAssociations[associationName];

				// TODO: Check fetchAssociations, check whereMap
				if(childAssociation.options.autoFetch) {
					query = self.addAssociation(query, associations.concat(childAssociation), select, autoFetchDepth);
				}
			});
		}
	}

	return query;
};

Table.prototype.addSelectColumnsForAssociation = function(query, associations, select) {
	if(!associations) {
		throw new Error();
	}

	var self = this;
	var referenceProperty = associations[associations.length - 1];

	var model = referenceProperty.getAssociatedModel();
	var properties = model.getAllProperties();

	var startSelect = associations.map(function(association) {
		return association.name + '.';
	}).join('');

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

	var alias = [self].concat(associations).map(function(a) {
		return a.name;
	}).join('_');

	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(!selectIsArray || selectAllProperties || propertyName == 'id' || selectProperties.indexOf(propertyName) >= 0) {
			if(property.isAllowed()) {
				query = query.column(alias + '.' + property.columnName + ' as ' + associations.map(function(association) {
					return association.name + property.columnNameIndicator;
				}).join('') + property.columnName);
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

					query = query.column(self.knex.raw(readOnly).wrap('(', ') as ' + associations.map(function(association) {
						return association.name + property.columnNameIndicator;
					}).join('') + property.columnName));
				}
			}
		}
	});

	return query;
};

Table.prototype.createSelectStatement = function(whereMap, limit, skip, sort, group, select, fetchAssociations, autoFetchDepth) {
	var self = this;
	var selectQuery = this.knex.from(this.name);
	var selectIsArray = Array.isArray(select);

	var usingCTE = (limit || skip);
	var withQuery = null;

	if(usingCTE) {
		withQuery = this.knex.select(this.name + '.*').from(this.name);
	}

	this.forEachProperty(function(property) {
		if(!selectIsArray && !property.options.isAggregate || property.name == 'id' && !group || select && select.indexOf(property.name) >= 0) {
			if(property.isAllowed()) {
				selectQuery = selectQuery.column(self.name + '.' + property.columnName);
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

					selectQuery = selectQuery.column(self.knex.raw(readOnly).wrap('(', ') as ' + quote(property.columnName)));
				}
			}
		}
	});

	this.forEachAssociation(function(association) {
		// TODO: Check key path of the whereMap.

		if(association.options.autoFetch || fetchAssociations && fetchAssociations.indexOf(association.name) >= 0) {
			selectQuery = self.addAssociation(selectQuery, [association], select, autoFetchDepth);
		}
		else if(whereMap[association.name]) {
			if(withQuery) {
				withQuery = self.addJoinStatement(withQuery, [association]);
			}
			else {
				selectQuery = self.addJoinStatement(selectQuery, [association]);
			}
		}
	});

	var associationNames = Object.keys(this.getAssociations());
	if(associationNames.length > 0 && !sort && this.getProperty('id') && !group) {
		// We don't want an implicit sorting when we are grouping.
		sort = {
			id: 'asc'
		};
	}

	selectQuery = this.addSortClause(selectQuery, sort);

	if(group) {
		var groupByPropertyNames;

		if(typeof group == 'string') {
			groupByPropertyNames = [group];
		}
		else if(Array.isArray(group)){
			groupByPropertyNames = group;
		}
		else {
			throw new Error('Invalid groupBy. Please provider either an array or a string.');
		}

		groupByPropertyNames.forEach(function(propertyName) {
			var property = self.getProperty(propertyName);

			if(!property) {
				throw new Error('Invalid group by property `' + group + '`.');
			}

			selectQuery = selectQuery.groupBy(self.name + '.' + property.columnName);
		});
	}

	if(withQuery) {
		withQuery = this.addSortClause(withQuery, sort);

		if(whereMap) {
			withQuery = this.addWhereClause(withQuery, whereMap);
		}

		if(limit > 0) {
			withQuery = withQuery.limit(limit);
		}

		if(skip > 0) {
			withQuery = withQuery.offset(skip);
		}

		if(associationNames.length > 0 && !sort && this.getProperty('id') && !group) {
			// We don't want an implicit sorting when we are grouping.
			withQuery = withQuery.orderBy('id', 'asc');
		}

		return this.knex.raw('WITH "' + this.name + '" AS (?) ?', [withQuery, selectQuery]);
	}
	else {
		if(whereMap) {
			selectQuery = this.addWhereClause(selectQuery, whereMap);
		}

		if(limit > 0) {
			selectQuery = selectQuery.limit(limit);
		}

		if(skip > 0) {
			selectQuery = selectQuery.offset(skip);
		}

		return selectQuery;
	}
};

Table.prototype.addValueClause = function(query, columnName, whereValue, i, property) {
	if(property && property.options.rawWhere) {
		// TODO: What if we have multiple values?
		// TODO: Do not use ? in knex. See if they support $x instead.

		if(property.options.rawWhere.indexOf('$1') >= 0) {
			query = query.whereRaw(property.options.rawWhere.replace('$1', '?'), [whereValue]);
		}
		else {
			query = query.whereRaw(property.options.rawWhere);
		}
	}
	else if(whereValue === null) {
		query = query.whereNull(columnName);
	}
	else if(whereValue && typeof whereValue.toQueryValue == 'function') {
		query = query.where(columnName, whereValue.toQueryValue());
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
			$ilike: ['ILIKE'],
			$regex: ['~']
		};

		Object.keys(whereValue).forEach(function(key) {
			var transformer = transformers[key];
			if(!transformer) {
				throw new Error('Invalid transformer `' + key + '`.');
			}

			if(whereValue[key] === null) {
				if(transformer.length <= 1) {
					throw new Error('Cannot use transformer `' + key + '` with NULL value.');
				}
				else {
					query = query.whereRaw(columnName + ' ' + transformer[1] + ' null');
				}
			}
			else {
				query = query.where(columnName, transformer[0], whereValue[key]);
			}
		});
	}
	else {
		query = query.where(columnName, whereValue);
	}

	return query;
};

Table.prototype.addWhereClause = function(query, whereMap) {
	var self = this;
	var propertyNames = Object.keys(whereMap);
	propertyNames.forEach(function(propertyName) {
		var property = self.getProperty(propertyName);

		if(!property) {
			throw new Error('Cannot find property with name `' + propertyName + '` on table `' + self.name + '`. Did you specify an invalid property name in where clause?');
		}

		var whereValue = whereMap[propertyName];
		var columnName;
		var firstProperty = self.getFirstProperty(propertyName);

		if(firstProperty) {
			query.whereExists(function() {
				var subquery = this.select().from(property.model.getTable().name);
				subquery = self.addValueClause(subquery, property.columnName, whereValue, 0, firstProperty);

				if(firstProperty.options.relationshipVia.isAllowed()) {
					subquery = subquery.whereRaw(firstProperty.options.relationshipVia.columnName + ' = ' + self.getName() + '.id');
				}
				else {
					subquery = subquery.whereRaw(self.name + '.' + firstProperty.columnName + ' = ' + property.model.getTable().name + '.id');
				}
			});
		}
		else {
			if(property.options.hasOne) {
				var alias = property.options.relationshipVia.model.getTable().name + '_' + property.name;
				columnName = alias + '.id';
			}
			else {
				if(firstProperty) {
					columnName = property.model.getTable().name + '_' + firstProperty.name + '.' + property.columnName;
				}
				else {
					// If the property is not for this model, we need to find the correct alias.
					columnName = property.model.getTable().name + '.' + property.columnName;
				}
			}

			query = self.addValueClause(query, columnName, whereValue, 0, property);
		}
	});

	return query;
};

Table.prototype.addSortClause = function(query, sort) {
	var self = this;

	if(sort) {
		if(typeof sort == 'string') {
			throw new Error('Ordering by a string is not allowed anymore. Use PropertyTypes#Aggregate to order by something more advanced.');
		}
		else {
			Object.keys(sort).forEach(function(propertyName) {
				var property = self.getProperty(propertyName);

				if(!property) {
					throw new Error('Warning: cannot find property `' + propertyName + '` in orderBy.');
				}

				var value = sort[propertyName];
				var sortValue = 'ASC';

				if(typeof value == 'string') {
					value = value.toUpperCase();

					if(value == 'ASC' || value == 'DESC') {
						sortValue = value;
					}
					else {
						throw new Error('Value `' + value + '` is not allowed in orderBy.');
					}
				}
				else {
					if(value < 0) {
						sortValue = 'DESC';
					}
					else {
						sortValue = 'ASC';
					}
				}

				if(property.options.isVirtual) {
					query = query.orderBy(property.columnName, sortValue);
				}
				else {
					query = query.orderBy(self.name + '.' + property.columnName, sortValue);
				}
			});
		}
	}

	return query;
};

Table.prototype.addLimitClause = function(query, limit) {
	if(limit > 0) {
		query = query.limit(limit);
	}

	return query;
};

Table.prototype.addOffsetClause = function(query, skip) {
	if(skip > 0) {
		query = query.offset(skip);
	}

	return query;
};

Table.prototype.addReturningClause = function(query) {
	var readOnlyProperties = ['*'];
	var self = this;
	this.forEachProperty(function(property) {
		if(property.options.counting && !property.options.readOnly) {
			property.options.readOnly = self.createReadOnlyStatement(property, property.options.counting);
		}

		// If this is a many association we can ignore this property
		if(property.options.readOnly && typeof property.options.readOnly == 'string' && !property.options.isAggregate) {
			var readOnly = property.options.readOnly.replace(/\$(\w+)(\("(.*?)"\))?/ig, function(match, readOnlyPropertyName, p2, targetPropertyName) {
				if(targetPropertyName) {
					return self.createReadOnlyStatement(property, targetPropertyName);
				}
				else {
					return inflection.underscore(readOnlyPropertyName);
				}
			});

			readOnlyProperties.push(self.knex.raw(readOnly).wrap('(', ') as ' + property.columnName));
		}
	});

	query = query.returning(readOnlyProperties);

	return query;
};

Table.prototype.createDeleteStatement = function(whereMap, limit, skip, sort) {
	var deleteQuery = this.knex.from(this.name).delete();

	deleteQuery = this.addReturningClause(deleteQuery);

	if((limit || skip || sort) && this.getProperty('id')) {
		var withQuery = this.knex.from(this.name).select();

		withQuery = this.addWhereClause(withQuery, whereMap);

		withQuery = this.addSortClause(withQuery, sort);
		withQuery = this.addLimitClause(withQuery, limit);
		withQuery = this.addOffsetClause(withQuery, skip);

		deleteQuery = deleteQuery.whereRaw('"id" in (select "id" from "t")');

		return this.knex.raw('WITH "t" AS (?) ?', [withQuery, deleteQuery]);
	}
	else {
		deleteQuery = this.addWhereClause(deleteQuery, whereMap);
		return deleteQuery;
	}
};

Table.prototype.createUpdateStatement = function(whereMap, setMap, limit, skip, sort) {
	var updateQuery = this.knex.from(this.name);

	updateQuery = this.addSetClause(updateQuery, setMap);
	updateQuery = this.addReturningClause(updateQuery);

	if((limit || skip || sort) && this.getProperty('id')) {
		var withQuery = this.knex.from(this.name).select();

		withQuery = this.addSortClause(withQuery, sort);
		withQuery = this.addLimitClause(withQuery, limit);
		withQuery = this.addOffsetClause(withQuery, skip);

		withQuery = this.addWhereClause(withQuery, whereMap);
		updateQuery = updateQuery.whereRaw('"id" in (select "id" from "t")');
		return this.knex.raw('WITH "t" AS (?) ?', [withQuery, updateQuery]);
	}
	else {
		updateQuery = this.addWhereClause(updateQuery, whereMap);
		return updateQuery;
	}
};

Table.prototype.addInsertClause = function(query, setMap) {
	var insertMap = {};
	var self = this;
	Object.keys(setMap).forEach(function(propertyName) {
		var setValue = setMap[propertyName];
		var property = self.getProperty(propertyName);

		if(!property) {
			throw new Error('Could not find property `' + propertyName + '` in `' + self.name + '`.');
		}

		if(property.isAllowed()) {
			var columnName = property.columnName;

			if(setValue && typeof setValue.toQueryValue == 'function') {
				insertMap[columnName] = setValue.toQueryValue();
			}
			else {
				if(typeof setValue == 'string') {
					// This enables escaping in Postgres.
					insertMap[columnName] = setValue; //self.knex.raw('e?', [setValue]);
				}
				else {
					insertMap[columnName] = setValue;
				}
			}
		}
	});

	query = query.insert(insertMap);
	return query;
};

Table.prototype.createInsertStatement = function(setMap) {
	var insertQuery = this.knex(this.name);
	insertQuery = this.addInsertClause(insertQuery, setMap);
	insertQuery = this.addReturningClause(insertQuery);
	return insertQuery;
};

Table.prototype.insert = function(setMap) {
	var query = this.createInsertStatement(setMap);
	return this.query(query);
};

Table.prototype.update = function(whereMap, setMap, limit, skip, sort) {
	var query = this.createUpdateStatement(whereMap, setMap, limit, skip, sort);

	return this.query(query);
};

Table.prototype.select = function(whereMap, limit, skip, sort, group, select, associations, autoFetchDepth) {
	var query = this.createSelectStatement(whereMap, limit, skip, sort, group, select, associations, autoFetchDepth || 5);

	return this.query(query);
};

Table.prototype.remove = function(whereMap, limit, skip, sort) {
	var query = this.createDeleteStatement(whereMap, limit, skip, sort);
	return this.query(query);
};

Table.prototype.createSchema = function() {
	if(this.schemaName) {
		return this.query(this.knex.raw('CREATE SCHEMA IF NOT EXISTS ?', [this.schemaName]));
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

Table.prototype.dropStatement = function(cascade) {
	var clause = 'DROP TABLE ' + this.getName();

	if(cascade) {
		clause += ' CASCADE';
	}

	return clause;
};

Table.prototype.drop = function(cascade) {
	return this.rawQuery(this.dropStatement(cascade));
};

Table.prototype.exists = function() {
	return this.knex.schema.hasTable(this.name);
};
