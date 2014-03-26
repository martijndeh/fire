'use strict';

exports = module.exports = Connection;

var Q = require('q');
var stream = require('stream');
var util = require('util');

var debug = require('debug')('http');

function Connection(request, response) {
	this.request = request;
	this.response = response;
}

Connection.prototype.sendError = function(error) {
	debug('%d - %s', error.status || 500, this.request.url);
	
	this.response.statusCode = error.status || 500;
	this.response.end();
};

Connection.prototype.sendResponse = function(response) {
	var self = this;
	Q.when(response)
	.then(function(result) {
		if(result instanceof Error) {
			self.sendError(result);
		}
		else if(result instanceof stream.Stream) {
			debug('%d - %s', 200, self.request.url);
			
			self.response.statusCode = 200;
			result.pipe(self.response);
		}
		else {
			debug('%d - %s', 200, self.request.url);

			self.response.statusCode = 200;
			self.response.setHeader('Content-Length', Buffer.byteLength(result));
			self.response.end(result);
		}
	})
	.fail(function(error) {
		self.sendError(error);
	})
	.done();
};