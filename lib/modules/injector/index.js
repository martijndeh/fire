'use strict';

exports = module.exports = Injector;

var utils = require('./../../helpers/utils');

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
 */
function Injector(app) {
	this._dependencyMap = {};

	// A default dependency is `self`. This replaces the `var self = this;` line.
	this.register('self', function(self) {
		return self;
	});

	this.register('app', function() {
		return app;
	});
}

Injector.prototype.ignoreDisabled = true;

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
 * Executes a given constructor and injects dependencies based on the argument names of the constructor.
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
Injector.prototype.execute = function(constructor, privateMap) {
	var injectedConstructor = this.prepare(constructor);
	return new injectedConstructor(privateMap);
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
	var self = this;
	var dependencyNames = utils.getMethodArgumentNames(constructor);

	function Injected(privateMap) {
		return constructor.apply(this, dependencyNames.map(function(dependencyName) {
			if(privateMap[dependencyName]) {
				return privateMap[dependencyName];
			}
			else if(self._dependencyMap[dependencyName]) {
				return self._dependencyMap[dependencyName](this);
			}
			else {
				throw new Error('Unknown dependency `' + dependencyName + '`.');
			}
		}, this));
	}
	Injected.prototype = constructor.prototype;
	return Injected;
};
