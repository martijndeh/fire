'use strict';

exports = module.exports = Router;

var debug = require('debug')('fire:router');
var path = require('path');
var methods = require('methods');

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
 * This middleware loads files in the `middleware/` folder relative from your project's root directory.
 *
 * @constructor
 */
function Router(injector) {
	var _transportsMap = {};

	this.addTransport = function(name, transport) {
		_transportsMap[name] = transport;
	};

	this.getTransport = function(name) {
		return _transportsMap[name];
	};

	var _transports = function(callback) {
		Object.keys(_transportsMap).forEach(function(transportName) {
			callback(_transportsMap[transportName]);
		});
	};
	
	var _createRoute = function(method) {
		return function(path, constructor) {
			var preparedConstructor = injector.prepare(constructor);

			_transports(function(transport) {
				transport.addRoute(method, path, preparedConstructor, constructor);
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

			_transports(function(transport) {
				transport.addUse(path, preparedConstructor, constructor);
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
