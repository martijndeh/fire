'use strict';

exports = module.exports = HTTPServer;

var Q = require('q');
var debug = require('debug')('fire:http-server');
var express = require('express');

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
	}
	else {
		debug('App is disabled.');

		this.express = null;
	}
}

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
		debug('Start server on http://127.0.0.1:' + port + '/');
	}
	else {
		debug('Start server on http://127.0.0.1/');
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
