exports = module.exports = Client;

var Q = require('q');

function Client(internal, done) {
	this.internal 	= internal;
	this.done 		= done;
}

Client.prototype.query = function(query, parameters) {
	return Q.ninvoke(this.internal, 'query', query, parameters);
};

Client.prototype.rollback = function() {
	var self = this;
	return this.query('ROLLBACK')
		.then(function(result) {
			self.done();
			return result;
		})
		.catch(function(error) {
			self.done(error);
			throw error;
		});
};

Client.prototype.commit = function() {
	var self = this;
	return this.query('COMMIT')
		.then(function(result) {
			self.done();
			return result;
		})
		.catch(function(error) {
			self.done(error);
			throw error;
		});
};
