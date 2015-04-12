'use strict';

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
	this.app.service = function(serviceConstructor) {
		self.app.injector.register(serviceConstructor.name, function() {
			return self.app.injector.construct(serviceConstructor);
		});

		return existingServiceMethod(serviceConstructor);
	};

	var existingFactoryMethod = this.app.factory;

	this.app.factory = function(factoryConstructor) {
		self.app.injector.register(factoryConstructor.name, function() {
			return self.app.injector.call(factoryConstructor);
		});

		return existingFactoryMethod(factoryConstructor);
	};
}
Isomorphic.prototype.stages = ['run', 'build', 'release'];
