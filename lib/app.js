'use strict';

var Controllers = require('./modules/controllers/controllers');
var Views = require('./modules/views/views');
var Workers = require('./modules/workers/workers');
var Models = require('./modules/models/models');
var AutoCrud = require('./modules/auto-crud/auto-crud');

var config = require('./helpers/config');

var path = require('path');
var inflection = require('inflection');
var express = require('express');

var Q = require('q');

var debug = require('debug')('fire:app');

exports = module.exports = App;

function App() {
	this.modules = [];

	this.server = express();
	this.server.disable('x-powered-by');

	// TODO: Add a way to remove modules?

	this.addModule(Workers);
	this.addModule(Models);
	this.addModule(Views);
	this.addModule(Controllers);
	this.addModule(AutoCrud);
}

App.prototype.addModule = function(moduleConstructor) {
	var module = new moduleConstructor(this);
	this.modules.push(module);

	// We get the name of the property based on the name of the constructor
	var propertyName = inflection.camelize(moduleConstructor.name, true);

	Object.defineProperty(this, propertyName, {
		value: module
	});
};

App.prototype._setup = function() {
	var result = Q.when(true);

	this.modules.forEach(function(module) {
		result = result.then(function() {
			return Q.when(module.setup.call(module, config.basePath));
		});
	});

	return result;
};

App.prototype.run = function() {
	var self = this;
	return this._setup()
		.then(function setupServer() {
			var port = null;

			if(!process.env.PORT && process.env.NODE_ENV != 'test') {
				debug('PORT environment variable not set. Setting to default port 3000.');
			}
			else if(process.env.NODE_ENV == 'test') {
				//
			}
			else {
				port = (process.env.PORT || 3000);
			}

			debug('Start server on http://127.0.0.1:' + port + '/');

			// We resolve the promise with the return value from Server#listen.
			return self.server.listen(port);
		})
		.fail(function(error) {
			console.log(error);
			console.log(error.stack);
			console.log('Error when starting, bleh.');
			throw error;
		});	
};