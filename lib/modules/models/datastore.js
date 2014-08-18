exports = module.exports = Datastore;

var Q = require('q');
var Client = require('./client');
var url = require('url');
var Table = require('./table');
var Model = require('./model');
var PropertyTypes = require('./property-types');
var pg = require('pg');
var debug = require('debug')('fire:sql');

/**
 * Creates a datastore instance to `databaseURL`.
 *
 * If no databaseURL is set, in development mode, it tries to connect to a local Postgres database named after the current user with the current user's username, no password. This is the default database on Postgres (at least on Mac).
 *
 * Currently only the postgres: and pg: protocols are supported.
 *
 * @param  {String} databaseURL The URL to the database.
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

	// TODO: Move transactions to migrations as they should only be used there.
	this.currentTransaction = null;

	// TODO: Move this to Model instead.
	Object.keys(PropertyTypes).forEach(function(propertyName) {
		// We check if it's set already, as e.g. migrations swizzle these methods
		if(!Model.prototype[propertyName]) {
			Model.prototype[propertyName] = PropertyTypes[propertyName];
		}
	});
}

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
Datastore.prototype.setup = function() {
	var self = this;
	return this.query('SELECT * FROM pg_extension WHERE extname = $1', ['uuid-ossp'])
		.then(function(result) {
			if(result.rows.length > 0) {
				return true;
			}
			else {
				console.log('Warning: extension `uuid-ossp` not loaded by default. Trying to load manually. Please consider loading this yourself.');

				return self.query('SELECT * FROM pg_available_extensions WHERE name = $1', ['uuid-ossp'])
					.then(function(result2) {
						if(result2.rows.length > 0) {
							return self.query('CREATE EXTENSION "uuid-ossp"');
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

/**
 * Connects to the database and resolves with Client. It's generally easier to call Datastore#query.
 *
 * @return {Promise} Resolves with a Client.
 */
Datastore.prototype.connect = function() {
	if(!this.databaseURL) {
		throw new Error('Trying to connect to datastore but no DATABASE_URL set.');
	}

	var defer = Q.defer();
	pg.connect(this.databaseURL, function(error, client, done) {
		if(error) {
			defer.reject(error);
		}
		else {
			defer.resolve(new Client(client, done));
		}
	});

	return defer.promise;
};

/**
 * Connects the database and executes query. See Client#query.
 *
 * @param  {String} query      The SQL statement.
 * @param  {Array} parameters The parameters to pass to the statement.
 * @return {Object}            Result set.
 */
Datastore.prototype.query = function(query, parameters) {
	debug('%s (%s)', query, parameters ? parameters : '');

	if(this.currentTransaction) {
		return this.currentTransaction.query(query, parameters);
	}
	else {
		return this.connect()
			.then(function(client) {
				return client.query(query, parameters)
					.then(function(result) {
						client.done();
						return result;
					})
					.catch(function(error) {
						client.done(error);

						debug('Error: %s', error);
						throw error;
					});
			});
	}
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
