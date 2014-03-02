exports = module.exports = Connection;

var Q = require('q');
var stream = require('stream');
var util = require('util');

function Connection(request, response) {
	this.request = request;
	this.response = response;
}

Connection.prototype.sendError = function(error) {
	console.log('send error');
	console.log(error);
	
	this.response.statusCode = error.status || 500;
	this.response.end();
}

Connection.prototype.sendResponse = function(response) {
	Q(response)
		.then(function(result) {
			if(result instanceof Error) {
				this.sendError(result);
			}
			else if(result instanceof stream.Stream) {
				this.response.statusCode = 200;
				result.pipe(this.response);
			}
			else {
				this.response.statusCode = 200;
				this.response.setHeader('Content-Length', Buffer.byteLength(result));
				this.response.end(result);
			}
		}.bind(this))
		.fail(function(error) {
			this.sendError(error);
		}.bind(this))
		.done();
	
}