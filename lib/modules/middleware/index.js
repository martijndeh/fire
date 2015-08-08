'use strict';

exports = module.exports = Middleware;

var debug = require('debug')('fire:middleware');
var path = require('path');
var methods = require('methods');
var Q = require('q');
var utils = require('./../../helpers/utils');

/**
 * The middleware module is an express-like middleware system with dependency injection and promise support.
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
 * This middleware loads files in the `middleware/` folder relative from your project's root directory.
 *
 * @constructor
 */
function Middleware(HTTPServer, injector) {
	var _createRoute = function(method) {
		var express = HTTPServer.express;

		if(!express) {
			return function() {};
		}

		return function(path, constructor) {
			var preparedConstructor = injector.prepare(constructor);

			express[method](path, function(request, response, next) {
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
						if(error) {
							debug(error);

							response.status(error.status || 500).send({
								error: error.message
							});
						}
						else {
							response.status(500).send({error: 'Internal Server Error'});
						}
					})
					.done();
			});
		};
	};

	var _createUse = function() {
		var express = HTTPServer.express;

		if(!express) {
			return function() {};
		}

		return function(path, callback, shouldBeUndefined) {
			if(typeof shouldBeUndefined != 'undefined') {
				throw new Error('App#use can only receive two arguments.');
			}

			var middleware = typeof callback != 'undefined' ? callback : path;
			var route = typeof callback != 'undefined' ? path : '/';

			var preparedMiddleware = injector.prepare(middleware);
			var dependencyNames = utils.getMethodArgumentNames(middleware);

			if(dependencyNames.indexOf('error') != -1) {
				express.use(route, function(error, request, response, next) {
					var privateMap = {};
					privateMap.request = request;
					privateMap.response = response;
					privateMap.next = next;
					privateMap.error = error;

					Object.keys(request.params).forEach(function(paramName) {
						privateMap[paramName] = request.params[paramName];
					});

					preparedMiddleware(privateMap);
				});
			}
			else {
				express.use(route, function(request, response, next) {
					var privateMap = {};
					privateMap.request = request;
					privateMap.response = response;
					privateMap.next = next;

					Object.keys(request.params).forEach(function(paramName) {
						privateMap[paramName] = request.params[paramName];
					});

					Q.when(preparedMiddleware(privateMap))
						.then(function() {
							next();
						})
						.catch(function(error) {
							next(error);
						});
				});
			}
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

			app.requireDirSync(path.join(basePath, 'middleware'));
		}
	};
}
