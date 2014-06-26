'use strict';

var Controllers = require('./modules/controllers/controllers');
var Views = require('./modules/views/views');
var Workers = require('./modules/workers/workers');
var Models = require('./modules/models/models');
var AutoCrud = require('./modules/auto-crud/auto-crud');

var config = require('./helpers/config');
var fire = require('./firestarter');

var inflection = require('inflection');
var express = require('express');

var Q = require('q');

var debug = require('debug')('fire:app');

exports = module.exports = App;

function App(name, options) {
	this.name = name || 'app';
	this.options = options || {};

	this.modules = [];

	this.express = express();
	this.express.disable('x-powered-by');

	// TODO: Add a way to remove modules?

	this.addModule(Workers);
	this.addModule(Models);
	this.addModule(AutoCrud);
	this.addModule(Views);
	this.addModule(Controllers);
}

App.prototype.addModel = function(modelName, model) {
	debug('App#addModel `' + modelName + '`');

	var result = Q.when(true);

	this.modules.forEach(function(module_) {
		if(module_.addModel) {
			result = result.then(function() {
				return Q.when(module_.addModel(modelName, model));
			});
		}
	});

	return result;
};

App.prototype.addControllerConstructor = function(controllerConstructor) {
	debug('App#addControllerConstructor `' + controllerConstructor.name + '`');

	this.modules.forEach(function(module_) {
		if(module_.addControllerConstructor) {
			module_.addControllerConstructor(controllerConstructor);
		}
	});
};

App.prototype.addModelConstructor = function(modelConstructor) {
	debug('App#addModelConstructor `' + modelConstructor.name + '`');

	this.modules.forEach(function(module_) {
		if(module_.addModelConstructor) {
			module_.addModelConstructor(modelConstructor);
		}
	});
};

App.prototype.addModule = function(moduleConstructor) {
	var module_ = new moduleConstructor(this);
	this.modules.push(module_);

	// We get the name of the property based on the name of the constructor
	var propertyName = inflection.camelize(moduleConstructor.name, true);

	Object.defineProperty(this, propertyName, {
		value: module_
	});
};

App.prototype._setup = function() {
	var result = Q.when(true);

	this.modules.forEach(function(module_) {
		result = result.then(function() {
			return Q.when(module_.setup.call(module_, config.basePath));
		});
	});

	return result;
};

App.prototype.stop = function() {
	var defer = Q.defer();
	fire._app = null;

	this.server.close(defer.makeNodeResolver());
	return defer.promise;
};

App.prototype.run = function() {
	debug('App#run');

	if(this.server) {
		throw new Error('Must not call App#run multiple times.');
	}

	var self = this;
	return this._setup()
		.then(function setupServer() {
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

			console.log('run done');

			// We resolve the promise with the return value from Server#listen.
			self.server = self.express.listen(port);
			return self.server;
		})
		.fail(function(error) {
			console.log(error);
			console.log(error.stack);
			console.log('Error when starting, bleh.');
			throw error;
		});	
};