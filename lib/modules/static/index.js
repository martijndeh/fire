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
function Static(app) {
	this.app = app;
}

Static.prototype.stages = ['run'];

/**
 * Starts the static express middlewares.
 *
 * This modules should not be used during production.
 */
Static.prototype.setup = function() {
	if(this.app.container.numberOfApps() == 1) {
		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, 'public')));
		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public')));
	}
	else {
		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, 'public', this.app.name)));
		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public', this.app.name)));

		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, 'public', '_shared')));
		this.app.HTTPServer.express.use(express.static(path.join(config.basePath, '.fire', '.build', 'public', '_shared')));
	}
};
