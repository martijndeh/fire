'use strict';

var util = require('util');

exports = module.exports = Isomorphic;

/**
 * This module makes the AngularJS-based App#service and App#factory calls available in the back-end, too.
 *
 * @constructor
 */
function Isomorphic(app) {
	this.app = app;

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
