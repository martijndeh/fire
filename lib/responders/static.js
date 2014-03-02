exports = module.exports = StaticResponder;

var Q = require('q');
var fs = require('fs');
var path = require('path');
var config = require('./../config');

var mime = require('mime');

function StaticResponder() {
	
}

StaticResponder.prototype.parseConnection = function(connection) {	
	var defer = Q.defer();

	var filePath = path.join(config.basePath, 'public', connection.request.url);
	var stream = fs.createReadStream(filePath)
		.on('error', function(error) {
			defer.reject();
		})
		.on('open', function() {
			connection.response.setHeader('Content-Type', mime.lookup(filePath));

			defer.resolve(stream);
		})

	return defer.promise;
}