'use strict';

exports = module.exports = Static;

var config = require('./../../helpers/config');

var express = require('express');
var path = require('path');

/**
 * Convenience module to route requests to static folders.
 *
 *	- Makes the public folder .. public. All files in public will be accessible.
 *
 * In production, you should not use this module. But rather, let something like nginx or a CDN handle your static assets. Compiling scripts at runtime in production is also something you should avoid.
 *
 * @param {App} app The app.
 * @constructor
 */
function Static(app, HTTPServer) {
	this.stages = ['run'];
	this.setup = function() {
		if(HTTPServer.express) {
			if(process.env.ENABLE_COMPRESSION) {
				HTTPServer.express.use(require('compression')());
			}

			if(app.container.numberOfApps() == 1) {
				HTTPServer.express.use(express.static(path.join(config.basePath, 'public')));
				HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public')));
			}
			else {
				HTTPServer.express.use(express.static(path.join(config.basePath, 'public', app.name)));
				HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public', app.name)));

				HTTPServer.express.use(express.static(path.join(config.basePath, 'public', '_shared')));
				HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public', '_shared')));
			}
		}
	};
}
