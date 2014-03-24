exports = module.exports = Client;

var Q = require('q');

function Client(internal, done) {
	this.internal = internal;
	this.done = done;
}

Client.prototype.query = function() {
	return Q.npost(this.internal, 'query', Array.prototype.slice.call(arguments, 0));
}
