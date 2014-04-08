'use strict';

exports = module.exports = Postgres;

var util = require('util');
var Datastore = require('./../../datastore');
var pg = require('pg');
var debug = require('debug')('fire:sql');

var Q = require('q');

function Client(internal, done) {
	this.internal = internal;
	this.done = done;
}

Client.prototype.query = function(query, parameters) {
	debug('%s (%s)', query, parameters ? JSON.stringify(parameters) : '');

	var defer = Q.defer();
	var self = this;
	this.internal.query(query, parameters, function(error, result) {
		if(error) {	
			debug('Error: %s', error);

			defer.reject(error);
		}
		else {
			defer.resolve(result);
		}
	});

	return defer.promise;
};

Client.prototype.rollback = function() {
	var self = this;
	return this.query('ROLLBACK')
		.then(function(result) {
			self.done();
			return result;
		})
		.fail(function(error) {
			self.done();
			throw error;
		})
};

Client.prototype.commit = function() {
	var self = this;
	return this.query('COMMIT')
		.then(function(result) {
			self.done();
			return result;
		})
		.fail(function(error) {
			self.done();
			throw error;
		})
};

function Postgres(databaseURL) {
	this.databaseURL = databaseURL;
	this.currentTransaction = null;

	Datastore.apply(this, arguments);
}

util.inherits(Postgres, Datastore);


Postgres.prototype.connect = function() {
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

Postgres.prototype.query = function(query, parameters) {
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
					.fail(function(error) {
						client.done();
						throw error;
					})
			});
	}
}
