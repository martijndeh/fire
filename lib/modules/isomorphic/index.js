'use strict';

var util = require('util');
var path = require('path');

var http = require('http');
var https = require('https');
var url = require('url');

exports = module.exports = Isomorphic;

/**
 * This module makes the AngularJS-based App#service and App#factory calls available in the back-end, too.
 *
 * @constructor
 */
function Isomorphic(app) {
	this.app = app;

	this.app.injector.register('$q', function() {
		return require('q');
	});

	this.app.injector.register('$http', function() {
		return {
			get: function(optionsOrString, callback) {
				var options = {};
				if(typeof optionsOrString == 'string') {
					options = url.parse(optionsOrString);
				}
				else {
					options = optionsOrString;
				}

				if(options.protocol == 'https:') {
					return https.get(options, callback);
				}
				else if(options.protocol == 'http:') {
					return http.get(options, callback);
				}
				else {
					throw new Error('Unknown protocol `' + options.protocol + '` not supported by $http.');
				}
			}
		};
	});

	this.app.injector.register('fire', function() {
		return require('../../..');
	});

	var existingServiceMethod = this.app.service;

	var self = this;
	this.app.service = function(serviceConstructor, shouldBeUndefined) {
		if(typeof shouldBeUndefined != 'undefined') {
			throw new Error('In App#service, please only specify one parameter which is the service function. The name of the service should be the name of the function e.g.: app.service(function MyService() {}).\n\n' + util.inspect(serviceConstructor));
		}

		self.app.injector.register(serviceConstructor.name, function() {
			return self.app.injector.construct(serviceConstructor);
		});

		return existingServiceMethod(serviceConstructor);
	};

	var existingFactoryMethod = this.app.factory;

	this.app.factory = function(factoryConstructor, shouldBeUndefined) {
		if(typeof shouldBeUndefined != 'undefined') {
			throw new Error('In App#factory, please only specify one parameter which is the factory function. The name of the factory should be the name of the function e.g.: app.factory(function MyFactory() {}).\n\n' + util.inspect(factoryConstructor));
		}

		self.app.injector.register(factoryConstructor.name, function() {
			return self.app.injector.call(factoryConstructor);
		});

		return existingFactoryMethod(factoryConstructor);
	};
}
Isomorphic.prototype.stages = ['run', 'build', 'release'];

Isomorphic.prototype.setup = function(basePath) {
	['services', 'factories'].forEach(function(directoryName) {
		this.app.requireDirSync(path.join(basePath, directoryName));
	}, this);
};
