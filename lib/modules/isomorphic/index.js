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
	app.injector.register('$q', function() {
		return require('q');
	});

	// TODO: Move this to another module.
	app.injector.register('$http', function() {
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

	app.injector.register('fire', function() {
		return require('../../..')._getFirestarter();
	});

	this.exports = function() {
		return {
			service: function(serviceConstructor, shouldBeUndefined) {
				if(typeof shouldBeUndefined != 'undefined') {
					throw new Error('In App#service, please only specify one parameter which is the service function. The name of the service should be the name of the function e.g.: app.service(function MyService() {}).\n\n' + util.inspect(serviceConstructor));
				}

				app.injector.register(serviceConstructor.name, function() {
					return app.injector.construct(serviceConstructor);
				});
			},

			factory: function(factoryConstructor, shouldBeUndefined) {
				if(typeof shouldBeUndefined != 'undefined') {
					throw new Error('In App#factory, please only specify one parameter which is the factory function. The name of the factory should be the name of the function e.g.: app.factory(function MyFactory() {}).\n\n' + util.inspect(factoryConstructor));
				}

				app.injector.register(factoryConstructor.name, function() {
					return app.injector.call(factoryConstructor);
				});
			}
		};
	};

	this.setup = function(basePath) {
		['services', 'factories'].forEach(function(directoryName) {
			app.requireDirSync(path.join(basePath, directoryName));
		});
	};
}
Isomorphic.prototype.stages = ['run', 'build', 'release'];
