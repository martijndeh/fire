'use strict';

exports = module.exports = Injector;

var utils = require('./../helpers/utils');

/**
 * The injector module is used for AngularJS-style dependency injection.
 *
 * Modules can either register dependencies via the {@link Injector#register} method or execute constructors which need dependencies injected via {@link Injector#execute}.
 *
 * For example, to register a dependency called `MyService`:
 * ```js
 * function MyService() {
 * }
 *
 * var service = new MyService();
 *
 * injector.register('MyService', function() {
 * 	return service;
 * });
 * ```
 *
 * and to inject this in a constructor:
 * ```
 * function MyConstructor(MyService) {
 * 	// MyService is the MyService instance previously registered.
 * }
 *
 * var instance = injector.execute(MyConstructor);
 * ```
 *
 * A `self` dependency is available which replaces the `var self = this;` line. For example:
 * ```
 * function MyTest(self) {
 * 	// self === this
 * }
 *
 * injector.execute(MyTest);
 * ```
 *
 * @constructor
 */
function Injector(app) {
	this._dependencyMap = {};

	// TODO: Export a method to the app e.g. App#inject or something.

	// A default dependency is `self`. This replaces the `var self = this;` line.
	this.register('self', function(self) {
		return self;
	});

	this.register('app', app);
	this.register('injector', this);
}

Injector.prototype.stages = ['build', 'release', 'run'];

/**
 * Registers a dependecy with a given name and the callback which should return the dependency.
 *
 * For example, to register a dependency called `MyService`:
 * ```js
 * function MyService() {
 * }
 *
 * var service = new MyService();
 *
 * injector.register('MyService', function() {
 * 	return service;
 * });
 * ```
 *
 * To execute a constructor and inject dependencies see {@link Injector#execute}.
 *
 * @param  {String}   name     The name of the dependency to register.
 * @param  {Function} callback The callback to invoke when the dependency needs to resolve. The callback gets invoked with one argument which is the instance being created in {@link Injector#execute}.
 */
Injector.prototype.register = function(name, callback) {
	this._dependencyMap[name] = callback;
};

/**
 * Checks whether a dependency exists within the injector.
 *
 * @param  {String} name The name of the dependency.
 * @return {Boolean}
 */
Injector.prototype.exists = function(name) {
	return (typeof this._dependencyMap[name] != 'undefined');
};

/**
 * Removes an already registered dependency.
 *
 * @param {String} name The name of the dependency to unregister.
 */
Injector.prototype.unregister = function(name) {
	delete this._dependencyMap[name];
};

/**
 * Executes a given constructor and returns the new instance. This injects dependencies based on the argument names of the constructor.
 *
 * For example, this injects the `MyService` dependency when initiating `MyConstructor`: *
 * ```
 * function MyConstructor(MyService) {
 * 	// MyService is the MyService instance previously registered.
 * }
 *
 * var instance = injector.execute(MyConstructor);
 * ```
 *
 * Private dependencies can be injected which need to be passed in via `privateMap`.
 *
 * @param  {Constructor} constructor The constructor to invoke.
 * @param  {Dictionary} privateMap The private dependency map.
 * @return {Instance}             An instance created from `constructor`. Similar to calling `new constructor()`.
 */
Injector.prototype.construct = function(constructor, privateMap) {
	var injectedConstructor = this.prepare(constructor);
	return new injectedConstructor(privateMap);
};

/**
 * See {@link Injector#construct}.
 */
Injector.prototype.execute = function(constructor, privateMap) {
	return this.construct(constructor, privateMap);
};

/**
 * This invokes the constructor and returns it's return value. The constructor may be any type, and if a function is given, it's executed. If any other type is given, it's returned instead.
 *
 * @param  {Constructor} constructor The constructor to execute.
 * @param  {Dictionary} privateMap  The private dependencies.
 * @return {Any}             The return value of the constructor.
 */
Injector.prototype.call = function(constructor, privateMap, caller) {
	var type = typeof constructor;
	if(type == 'undefined') {
		throw new Error('Injector#call required constructor to be defined, but it\'s undefined.');
	}
	else if(type == 'function') {
		var injectedConstructor = this.prepare(constructor);
		if(caller) {
			return injectedConstructor.call(caller, privateMap);
		}
		else {
			return injectedConstructor(privateMap);
		}
	}
	else {
		return constructor;
	}
};

/**
 * Prepares a constructor for dependency injection. This returns a constructor which takes `privateMap` as argument.
 *
 * ```
 * function Test(MyService) {
 * 	//
 * }
 *
 * var TestConstructor = injector.prepare(TestConstructor);
 * var instance = new TestConstructor({});
 * ```
 *
 * @param  {Constructor} constructor The constructor to prepare for dependency injection.
 * @return {Constructor}             A new constructor prepared for dependency injection.
 */
Injector.prototype.prepare = function(constructor) {
	if(typeof constructor != 'function') {
		throw new Error('Injector#prepare requires first argument to be a function, but `' + typeof constructor + '` given.');
	}

	var self = this;
	var dependencyNames = utils.getMethodArgumentNames(constructor);

	function Injected(privateMap) {
		return constructor.apply(this, dependencyNames.map(function(dependencyName) {
			if(privateMap && typeof privateMap[dependencyName] != 'undefined') {
				return privateMap[dependencyName];
			}
			else if(typeof self._dependencyMap[dependencyName] == 'function') {
				return self._dependencyMap[dependencyName](this);
			}
			else if(typeof self._dependencyMap[dependencyName] != 'undefined') {
				return self._dependencyMap[dependencyName];
			}
			else {
				// Unknown dependencies are valid and should not return an error.
				// return undefined;
			}
		}, this));
	}
	Injected.prototype = constructor.prototype;
	return Injected;
};
