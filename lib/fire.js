var App = require('./app');
var http = require('http');
var path = require('path');
var config = require('./config');
var Connection = require('./connection');
var jade = require('jade');
//var mu = require('mu2');
var orm = require('orm');
var Q = require('q');

exports = module.exports = function(options) {
	config.basePath = path.resolve('./');

	var app = new App();

	app.views.contentType = 'text/html';
	app.views.render = function(filePath, models) {
		return Q.nfcall(jade.renderFile, filePath, models);
	}

	/*
	MainController.prototype.render = function(filePath, objects) {
		return mu.compileAndRender(filePath, objects);
	}
	*/

	app.models.connect = function(databaseUrl) {	
		return Q.nfcall(orm.connect, databaseUrl);
	}

	var server = http.createServer(function(request, response) {
		app.parseConnection.call(app, new Connection(request, response));
	});

	var done = false;

	function setup() {
		if(!done) {
			done = true;

			app.controllers.setup(path.join(config.basePath, 'controllers'), app.models);
			app.views.setup(path.join(config.basePath, 'views'));

			if(app.models.connect) {
				if(!process.env.DATABASE_URL) {
					console.log('WARNING: no DATABASE_URL environment variable provided. Did you forget to include one?');
				}
				else {
					app.models.connect(process.env.DATABASE_URL).then(function(db) {
						app.models.setup(path.join(config.basePath, 'models'), db);

						db.sync();
					}).fail(function(error) {
						console.dir(error);
						console.log(error.stack)
					})
					.done();
				}
			}
		}
	}

	//todo: we should simply return the app directly
	return {
		//todo: yea, we should change this--I want the public API to be singular and the internal API to be plural
		view: app.views,
		models: app.models,
		run: function() {
			setup();
			
			var port = process.env.PORT || 3000;

			console.log('Server running on port ' + port + '.');

			return server.listen(process.env.PORT || 3000);
		}
	}
}