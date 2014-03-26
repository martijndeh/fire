exports = module.exports = JSONMiddleware;

var debug = require('debug')('http');

var Q = require('q');
var mime = require('mime');

function JSONMiddleware() {
	
}

JSONMiddleware.prototype.parseConnection = function(connection, controller) {
	var defer = Q.defer();

	//application/json;charset=UTF-8
	var contentType = connection.request.headers['content-type'];
	if(contentType && mime.extension(contentType) == 'json') {
		var body = '';

		//todo: is there some kind of limit? we do not want to parse excessive amounts of data
		//perhaps this is a job for a reverse proxy in production
		//todo: move this to a separate middleware as it's likely this will be needed by other middlewares
		connection.request.on('data', function(chunk) {
			body += chunk;
		})
		connection.request.on('end', function() {
			if(body) {
				try {
					controller.body = JSON.parse(body);
				}
				catch(e) {
					debug('Invalid JSON in request: %s.', body);
				}

				if(!controller.body) {
					controller.body = {};
				}

				controller.json = function(keys) {
					var json = {};
					keys.forEach(function(key) {
						if(typeof controller.body[key] != 'undefined') {
							json[key] = controller.body[key];
						}
					})
					return json;
				};
			}

			defer.resolve();
		});
	}
	else {
		defer.resolve();
	}
	

	return defer.promise;
}