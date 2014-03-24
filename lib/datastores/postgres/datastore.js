'use strict';

exports = module.exports = Postgres;

var util = require('util');
var Datastore = require('./../../datastore');
var pg = require('pg');

var Q = require('q');

function Client(internal, done) {
	this.internal = internal;
	this.done = function() {
		done()
	};
}

Client.prototype.query = function(query, parameters) {
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

	/*
	var self = this;
	return Q.npost(this.internal, 'query', Array.prototype.slice.call(arguments, 0)).then(function(_) {
		self.done();
		self.done = function() {

		}
		return _;
	});
	*/

	return defer.promise;
};

function Postgres(databaseURL) {
	this.databaseURL = databaseURL;

	Datastore.apply(this, arguments);
}

util.inherits(Postgres, Datastore);


Postgres.prototype._connect = function() {
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
