exports = module.exports = Datastore;

var Q = require('q');
var Client = require('./client');
var url = require('url');
var Table = require('./table');
var Model = require('./model');
var PropertyTypes = require('./property-types');
var pg = require('pg');
var debug = require('debug')('fire:sql');

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

Datastore.prototype.setAllProperties = function() {
	throw new Error('Datastore#setAllProperties deprecated in favor of Datastore.setup().');
};

Datastore.prototype.getModel = function() {
	throw new Error('Datastore#getModel() is deprecated. require(\'model\') instead.');
};

Datastore.prototype.addModel = function(modelName, model) {
	model.setTable(new Table(model.schemaName || null, model, this));
};

Datastore.prototype.setupTable = function(table) {
	return table.create();
};
