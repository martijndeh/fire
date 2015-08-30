'use strict';

exports = module.exports = Router;

var debug = require('debug')('fire:router');
var path = require('path');
var methods = require('methods');
var Q = require('q');
var utils = require('../../helpers/utils');

/**
 * The Router exports route creation methods like App#get and App#post.
 *
 * For example, the below create a simple HTTP GET route which returns all Party models:
 * ```
 * app.get('/parties', function(PartyModel) {
 * 	return PartyModel.find({});
 * });
 * ```
 *
 * A get route which finds a specific party:
 * ```
 * app.get('/parties/:partyID', function(partyID, PartyModel) {
 * 	return PartyModel.findOne({id: partyID});
 * });
 * ```
 *
 * This router loads files in the `middleware/` and `routes/` folders relative from your project's root directory.
 *
 * Under the hood, this module uses express to handle it's routing.
 *
 * @constructor
 */
function Router(injector, HTTPServer) {
	var _transportsMap = {};
	var express = HTTPServer.express;

	this.handle = function(request, response, out) {
		return express.handle(request, response, out);
	};

	this.addTransport = function(transport) {
		var transportName = transport.constructor.name;
		if(typeof _transportsMap[transportName] != 'undefined') {
			throw new Error('Transport `' + transportName + '` already exists.');
		}

		_transportsMap[transportName] = transport;
	};

	this.getTransport = function(name) {
		return _transportsMap[name];
	};

	var forEachTransport = function(callback) {
		Object.keys(_transportsMap).forEach(function(transportName) {
			callback(_transportsMap[transportName]);
		});
	};

	var _createRoute = function(method) {
		return function(path, constructor) {
			console.log('Router#_createRoute ' + method + ' ' + path);

			var preparedConstructor = injector.prepare(constructor);

			express[method](path, function(request, response, next) {
				console.log('In ' + path);

	            var privateMap = {};
	            privateMap.request = request;
	            privateMap.response = response;
	            privateMap.next = next;

	            Object.keys(request.params).forEach(function(paramName) {
	                privateMap[paramName] = request.params[paramName];
	            });

	            Q.when(preparedConstructor(privateMap))
	                .then(function(result) {
	                    if(typeof result != 'undefined') {
	                        if(result) {
	                            response.json(result);
	                        }
	                        else {
	                            response.status(404).send();
	                        }
	                    }
	                    else {
	                        // The undefined result signals that the handler is itself sending a value over the response.
	                    }
	                })
	                .catch(function(error) {
						console.log(error);

	                    if(error) {
	                        debug(error);

	                        response.status(error.status || 500).json({
	                            error: error.message
	                        });
	                    }
	                    else {
	                        response.status(500).json({
								error: 'Internal Server Error'
							});
	                    }
	                })
	                .done();
	        });

			forEachTransport(function(transport) {
				if(transport.addRoute) {
					transport.addRoute(method, path, preparedConstructor, constructor);
				}
			});
		};
	};

	var _createUse = function() {
		return function(path_, constructor_, shouldBeUndefined) {
			if(typeof shouldBeUndefined != 'undefined') {
				throw new Error('App#use can only receive two arguments.');
			}

			var constructor = typeof constructor != 'undefined' ? constructor : path_;
			var path = typeof constructor != 'undefined' ? path_ : '/';

			var preparedConstructor = injector.prepare(constructor);

			var dependencyNames = utils.getMethodArgumentNames(constructor);

	        if(dependencyNames.indexOf('error') != -1) {
	            express.use(path, function(error, request, response, next) {
	                var privateMap = {};
	                privateMap.request = request;
	                privateMap.response = response;
	                privateMap.next = next;
	                privateMap.error = error;

	                Object.keys(request.params).forEach(function(paramName) {
	                    privateMap[paramName] = request.params[paramName];
	                });

	                preparedConstructor(privateMap);
	            });
	        }
	        else {
	            express.use(path, function(request, response, next) {
	                var privateMap = {};
	                privateMap.request = request;
	                privateMap.response = response;
	                privateMap.next = next;

	                Object.keys(request.params).forEach(function(paramName) {
	                    privateMap[paramName] = request.params[paramName];
	                });

	                Q.when(preparedConstructor(privateMap))
	                    .then(function() {
	                        next();
	                    })
	                    .catch(function(error) {
	                        next(error);
	                    });
	            });
	        }

			forEachTransport(function(transport) {
				if(transport.addUse) {
					transport.addUse(path, preparedConstructor, constructor);
				}
			});
		};
	};

	var _createMethods = function(object) {
		object.use = _createUse();
		methods.forEach(function(method) {
			object[method] = _createRoute(method);
		});
		return object;
	};

	this.exports = function() {
		var _ = {};
		return _createMethods(_);
	};

	_createMethods(this);

	this.stages = ['build', 'release', 'run'];

	this.setup = function(basePath, app) {
		if(basePath) {
			debug(path.join(basePath, 'middleware'));
			debug(path.join(basePath, 'routes'));

			app.requireDirSync(path.join(basePath, 'middleware'));
			app.requireDirSync(path.join(basePath, 'routes'));
		}
	};
}
