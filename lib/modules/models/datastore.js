exports = module.exports = Datastore;

var Q = require('q');
var url = require('url');
var Table = require('./table');
var Model = require('./model');
var PropertyTypes = require('./property-types');
var debug = require('debug')('fire:sql');

/**
 * Creates a datastore instance to `databaseURL`.
 *
 * If no databaseURL is set, in development mode, it tries to connect to a local Postgres database named after the current user with the current user's username, no password. This is the default database on Postgres (at least on Mac).
 *
 * Currently only the postgres: and pg: protocols are supported.
 *
 * @access private
 *
 * @param  {String} databaseURL The URL to the database.
 *
 * @return {Datastore}             A new datastore instance.
 */
Datastore.factory = function(databaseURL) {
	var datastore = null;

	if(databaseURL) {
		var object = url.parse(databaseURL);

		// Currently only Postgres is supported.
		// TODO: Implement sqlite, too.
		switch(object.protocol) {
			case 'postgres:':
			case 'pg:':
				datastore = new Datastore(databaseURL);
				break;

			default:
				throw new Error('Invalid DATABASE_URL set: only pg and postgres schemes are supported.');
		}
	}
	else {
		if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
			// To easen starting users, we'll try connecting to the default store, which is postgres://USER@127.0.0.1/USER
			var username = process.env.USER;
			databaseURL = 'postgres://' + username + '@127.0.0.1/' + username;

			console.log('Warning: no DATABASE_URL set in .env. Falling back to default (' + databaseURL + ').');
		}

		datastore = new Datastore(databaseURL);
	}

	return datastore;
};

/**
 * The datastore module. Communicates with the database. Currently only PostgreSQL is supported.
 *
 * @param {String} databaseURL URL to the database.
 * @constructor
 */
function Datastore(databaseURL) {
	this.databaseURL = databaseURL;

	this.knex = require('knex')({
		debug: false || process.env.KNEX_DEBUG,
		client: 'pg',
		connection: databaseURL,
		pool: {
			min: process.env.DATABASE_CONNECTION_POOL_MIN || 2,
			max: process.env.DATABASE_CONNECTION_POOL_MAX || 10
		}
	});
	this._transaction = null;

	Object.keys(PropertyTypes).forEach(function(propertyName) {
		// We check if it's set already, as e.g. migrations swizzle these methods
		if(!Model.prototype[propertyName]) {
			Model.prototype[propertyName] = PropertyTypes[propertyName];
		}
	});
}

Datastore.prototype.stop = function() {
	return this.knex.destroy();
};

/**
 * Starts a database transaction. This should not be used in the run phase. Only in the build or release phase.
 */
Datastore.prototype.beginTransaction = function() {
	var defer = Q.defer();

	var self = this;
	this.knex.transaction(function(transaction) {
		self._transaction = transaction;

		defer.resolve(transaction);
	}).exec();

	return defer.promise;
};

/**
 * Connects to the database and verifies if the uuid-ossp extension exists.
 *
 * If the uuid-ossp exists, but is not enabled, a warning is shown and the extension is enabled. If this fails, you may need to connect the database yourself with an admin account and enable the extension by executing `CREATE EXTENSION "uuid-ossp";`.
 *
 * If the extension does not exist, an error is thrown.
 *
 * The uuid-ossp is required because models, by default, have a UUID as primary key. It's currently not possible to change this behaviour.
 *
 * @return {Promise}
 */
Datastore.prototype.installExtensions = function() {
	var self = this;
	return this.rawQuery('SELECT * FROM pg_extension WHERE extname = ?', ['uuid-ossp'])
		.then(function(rows) {
			return (rows.length === 0);
		})
		.then(function(isNotLoaded) {
			if(isNotLoaded) {
				console.log('Warning: extension `uuid-ossp` not loaded by default. Trying to load manually. Please consider loading this yourself.');

				return self.rawQuery('SELECT * FROM pg_available_extensions WHERE name = ?', ['uuid-ossp'])
					.then(function(rows) {
						if(rows.length > 0) {
							return self.rawQuery('CREATE EXTENSION "uuid-ossp"');
						}
						else {
							throw new Error('Postgres extension `uuid-ossp` not available. Please install this extension.');
						}
					});
			}
		})
		.catch(function(error) {
			console.log(error);
			throw error;
		});
};

Datastore.prototype.setup = function() {
	console.log('Datastore#setup is deprecated.');
};

/**
 * Connects the database and executes query. See Client#query.
 *
 * @param  {knex} query A knex-constructed query.
 * @return {Object}            Result set.
 */
Datastore.prototype.query = function(query) {
	if(typeof query == 'string') {
		throw new Error('Datastore#query takes a knex query instance. Use Datastore#rawQuery if you want to pass a string.');
	}

	if(this._transaction) {
		query.transacting(this._transaction);
	}

	debug(query);

	return query
		.then(function(result) {
			// In some situations, it seems `result` is an array with the rows, or a Postgres result set with a rows property.
			if(typeof result.rows != 'undefined') {
				return result.rows;
			}
			else {
				return result;
			}
		})
		.catch(function(error) {
			throw error;
		});
};

Datastore.prototype.rawQuery = function(query, parameters) {
	return this.query(this.knex.raw(query, parameters));
};

/**
* Rolls back the transaction.
*/
Datastore.prototype.commitTransaction = function(transaction) {
	this._transaction = null;

	return Q.when(transaction).then(function() {
		return transaction.commit();
	});
};

/**
* Commits the transaction.
*/
Datastore.prototype.rollbackTransaction = function(transaction) {
	this._transaction = null;

	return Q.when(transaction).then(function() {
		return transaction.rollback();
	});
};

/**
 * Adds a table to the model.
 *
 * The SQL table isn't actually created in the database by this method.
 *
 * @param {String} modelName The name of the model.
 * @param {Model} model     The model.
 */
Datastore.prototype.addModel = function(modelName, model) {
	model.setTable(new Table(model.schemaName || null, model, this));
};

/**
 * Creates the table in the databse.
 *
 * @param {Table} table The table to create.
 */
Datastore.prototype.setupTable = function(table) {
	return table.create();
};
