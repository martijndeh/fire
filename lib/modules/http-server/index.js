'use strict';

exports = module.exports = HTTPServer;

var Q = require('q');
var debug = require('debug')('fire:http-server');
var express = require('express');
var bodyParser = require('body-parser');

/**
 * The HTTP server module. Actually creates the web server.
 * @constructor
 */
function HTTPServer(app) {
	this.server = null;

	if(!app.settings('disabled')) {
		debug('App is not disabled.');

		this.express = express();
		this.express.disable('x-powered-by');

		var keys = ['1038641b2d8e106ea60850034b43d7a9'];

		if(process.env.SESSION_KEYS) {
			keys = process.env.SESSION_KEYS.split(',');
		}
		else {
			if(!process.env.NODE_ENV || process.env.NODE_ENV != 'development' && process.env.NODE_ENV != 'test') {
				console.log('WARNING: Specify SESSION_KEYS in your .env to properly configure cookie session.');
			}
		}

		this.express.use(require('cookie-session')({
			keys: keys,
			name: 'sid',
			domain: process.env.COOKIE_DOMAIN,
			maxAge: Number(process.env.SESSION_MAX_AGE_MS) || 1000 * 60 * 60 * 24 * 7 * 52 * 10
		}));
		this.express.use(bodyParser.urlencoded({
			extended: true
		}));
		this.express.use(bodyParser.json());
		this.express.use(function(request, response, next) {
			if((request.headers['x-json-params'] == 1 || request.headers['x-json-params'] === true || request.headers['x-json-params'] === 'true' || request.headers['x-json-params'] == '1')) {
				var parseJSONParams = function(sourceOrList) {
					function _parseJSONParams(source) {
						var dest = {};

						Object.keys(source).forEach(function(key) {
							try {
								dest[key] = JSON.parse(source[key]);
							}
							catch(e) {
								debug(e);
							}
						});

						return dest;
					}

					if(Array.isArray(sourceOrList)) {
						return sourceOrList.map(_parseJSONParams);
					}
					else {
						return _parseJSONParams(sourceOrList);
					}
				};

				request.params = parseJSONParams(request.params);
				request.query = parseJSONParams(request.query);
				request.body = parseJSONParams(request.body);
			}

			next();
		});
	}
	else {
		debug('App is disabled.');

		this.express = null;
	}
}

HTTPServer.prototype.stages = ['run'];

/**
 * Starts the HTTP server if no argv is supplied or if --web is provided.
 *
 * E.g. in the Procfile:
 *
 * ```
 * web: node index.js --web
 * ```
 *
 * @param  {Dictionary} argv The arguments passed to the process.
 */
HTTPServer.prototype.start = function(argv) {
	if(process.env.NODE_ENV != 'test' && !argv.web && Object.keys(argv).length > 1) {
		debug('Not starting HTTP server');
		return false;
	}

	var port = null;

	if(process.env.NODE_ENV == 'test') {
		//
	}
	else {
		if(!process.env.PORT) {
			debug('PORT environment variable not set. Setting to default port 3000.');
		}

		port = (process.env.PORT || 3000);
	}

	if(port) {
		if(process.env.NODE_ENV == 'development') {
			console.log('Start server on http://127.0.0.1:' + port + '/');
		}
	}
	else {
		if(process.env.NODE_ENV == 'development') {
			console.log('Start server on http://127.0.0.1/');
		}
	}

	this.server = this.express.listen(port);
	return true;
};

/**
 * Stops the HTTP server by calling `close()` on the http server object.
 *
 * @return {Promise}
 */
HTTPServer.prototype.stop = function() {
	var defer = Q.defer();

	if(this.server) {
		this.server.close(defer.makeNodeResolver());
	}
	else {
		defer.resolve();
	}

	return defer.promise;
};
