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
				break;
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

	var self = this;
	Object.keys(PropertyTypes).forEach(function(propertyName) {
		// We check if it's set already, as e.g. migrations swizzle these methods
		if(!Model.prototype[propertyName]) {
			Model.prototype[propertyName] = PropertyTypes[propertyName];
		}
	});

	this._tables = [];
}

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
	debug('%s (%s)', query, parameters ? JSON.stringify(parameters) : '');

	if(this.currentTransaction) {
		return this.currentTransaction.query(query, parameters);
	}
	else {
		return this.connect()
			.then(function(client) {
				return client.query(query, parameters)
					.then(function(result) {
						return result;
					})
					.catch(function(error) {
						debug('Error: %s', error);

						throw error;
					})
					.fin(function() {
						client.done();
					});
			});
	}
};

Datastore.prototype.setAllProperties = function(ModelClass) {
	throw new Error('Datastore#setAllProperties deprecated in favor of Datastore.setup().');
}

Datastore.prototype.getModel = function() {
	throw new Error('Datastore#getModel() is deprecated. require(\'model\') instead.');
}

Datastore.prototype.addModel = function(modelName, model) {
	var schemaName = model.schemaName || null;

	var table = new Table(schemaName, modelName, this);
	this._tables.push(table);
	model.setTable(table);
}

Datastore.prototype.setupTable = function(table) {
	return table.create();
};
