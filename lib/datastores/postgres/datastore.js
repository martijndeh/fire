'use strict';

exports = module.exports = Postgres;

var util = require('util');
var Datastore = require('./../../datastore');
var pg = require('pg');
var debug = require('debug')('fire:sql');

var Q = require('q');

function Client(internal, done) {
	this.internal = internal;
	this.done = function() {
		done()
	};
}

Client.prototype.query = function(query, parameters) {
	debug('%s (%s)', query, parameters ? JSON.stringify(parameters) : '');

	var defer = Q.defer();
	var self = this;
	this.internal.query(query, parameters, function(error, result) {
		if(error) {			
			defer.reject(error);
		}
		else {
			defer.resolve(result);

			self.done();
		}
	});

	return defer.promise;
};

function Postgres(databaseURL) {
	this.databaseURL = databaseURL;

	Datastore.apply(this, arguments);
}

util.inherits(Postgres, Datastore);


Postgres.prototype._connect = function() {
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

Postgres.prototype.connect = function() {
	throw new Error('*** WARNING: Datastore#connect() is deprecated.')
}

Postgres.prototype.query = function(query, parameters) {
	return this._connect()
		.then(function(client) {
			return client.query(query, parameters);
		});
}
