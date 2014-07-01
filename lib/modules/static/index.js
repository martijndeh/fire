'use strict';

exports = module.exports = Static;

var config = require('./../../helpers/config');

var express = require('express');
var path = require('path');

function Static(app) {
	app.express.engine('html', require('jade').__express);
	app.express.engine('jade', require('jade').__express);
	app.express.use(require('less-middleware')(path.join(config.basePath, 'private'), {
		dest: path.join(config.basePath, 'public')
	}));

	// TODO: Disable this in production. This is only for convenience in development mode.

	app.express.use(express.static(path.join(config.basePath, 'public')));
	app.express.use('/scripts', express.static(path.join(config.basePath, '_assets')));
}

Static.prototype.setup = function() {
	//
};