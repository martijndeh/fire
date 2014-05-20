exports = module.exports = Client;

var Q = require('q');
var debug = require('debug')('fire:sql');

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