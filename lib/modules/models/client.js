exports = module.exports = Client;

var Q = require('q');

/**
 * A client is a connection to the datastore, see Datastore#connect, taken from the pg's connection pool.
 *
 * @param {pg.Client}   internal The client from the pg module.
 * @param {Function} done     When invoked, gives the client back to the connection pool.
 *
 * @access private
 * @constructor
 */
function Client(internal, done) {
	this.internal 	= internal;
	this.done 		= done;
}

/**
 * Wrapper function around pg.Client#query to return a Promise instead.
 *
 * @param  {String} query      The SQL statement to execute.
 * @param  {Array} parameters Any parameters passed to SQL statement. The first item is replaced with $1 in the query, etc.
 * @return {Promise}            Returns a result set, see pg.Client#query for the specifics.
 */
Client.prototype.query = function(query, parameters) {
	return Q.ninvoke(this.internal, 'query', query, parameters);
};

/**
 * Rolls back a transaction.
 *
 * See Client#begin.
 *
 * @return {Promise}
 */
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

/**
 * Commits a database transaction.
 *
 * See Client#begin.
 *
 * @return {Promise}
 */
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

/**
 * Begins a database transaction.
 *
 * Please make sure to invoke Client#commit to commit a transaction or Client#rollback to cancel a transaction.
 *
 * @return {Promise} Promise resolves with this instance.
 */
Client.prototype.begin = function() {
	var self = this;
	return this.query('BEGIN')
		.then(function() {
			return self.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
		})
		.then(function() {
			return self;
		});
};
