'use strict';

exports = module.exports = Static;

var config = require('./../../helpers/config');

var express = require('express');
var path = require('path');

function Static(app) {
	// TODO: Disable this in production. This is only for convenience in development mode.

	app.express.use('/styles', require('less-middleware')(path.join(config.basePath, 'styles'), {
		force: (!process.env.NODE_ENV || process.env.NODE_ENV == 'development'),
		dest: path.join(config.basePath, 'public', 'styles')
	}));
	app.express.use(express.static(path.join(config.basePath, 'public')));
	app.express.use('/scripts', express.static(path.join(config.basePath, '_assets')));
	app.express.use('/bower_components', express.static(path.join(config.basePath, 'bower_components')));
}

Static.prototype.setup = function() {
	//
};
