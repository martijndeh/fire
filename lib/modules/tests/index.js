exports = module.exports = Tests;

var Q = require('q');
var path = require('path');
var util = require('util');
var inflection = require('inflection');

var debug = require('debug')('fire:tests');

var Model = require('./../models/model');
var uuid = require('node-uuid');

var Test = require('./test');
var TestSession = require('./test-session');
var TestVariant = require('./test-variant');
var TestParticipant = require('./test-participant');

var Tester = require('./tester');

/**
 * A/B split testing module.
 *
 * This modules allows you to easily creates A/B tests. Tests optionally belong to one or multiple controllers.
 *
 * The below creates a test with two variants: A and B.
 * ```
 * app.test(function ColorOfHeaderTest() {
 * 	return {
 * 		controller: 'TestController',
 * 		variants: ['A', 'B']
 * 	};
 * });
 * ```
 *
 * This creates a test named ColorOfHeaderTest which is a client-side service available through dependecy injection. The test exposes two public methods:
 *
 * 1. `ColorOfHeaderTest#participate` makes the current user, either signed-in or not, participate to the test. The user automatically gets assigned to the variant with the least amount of participants. Users get distributed equally among all the different variants.
 * 2. `ColorOfHeaderTest#getVariant` returns the variant the user belongs to. If a user is not participating the test and this method is called, an error is thrown.
 *
 * If you assign a test to one or more controllers, a user automatically participates the test when the controller is loaded. This is because Node on Fire in the `$routeProvider` resolves the test dependency only after having called the participate method.
 * ```
 * app.controller(function TestController(ColorOfHeaderTest) {
 * 	if(ColorOfHeaderTest.getVariant() == 'A') {
 * 		// Show something in green
 * 	}
 * 	else {
 * 		// Show something in blue.
 * 	}
 * });
 * ```
 *
 * Because you generally want to know which test a user participates to, you can set a delegate to the `TestsService` to subscribe to participation events. The below registers a super property to Mixpanel whenever a user participates an event. This allows you to easily track conversion, retention and whatnot per test variant in Mixpanel.
 * ```
 * app.run(['TestsService', function(TestsService) {
 * 	TestsService.delegate = {
 * 		participate: function(test, variant) {
 * 			console.log('Join test ' + test + ' with variant ' + variant);
 *
 *			var properties = {};
 *			properties[test] = variant;
 *			mixpanel.register(properties);
 *		}
 *	};
 * }]);
 * ```
 */
function Tests(app) {
	this.app = app;
	this._constructors = {};
	this._tests = [];

	var self = this;
	this.app.test = function(testConstructor) {
		self._constructors[testConstructor.name] = testConstructor;
	};
}

Tests.prototype.stages = ['build', 'release', 'run'];

Tests.prototype.generator = function() {
	return new this.app.bridge.Generator(path.join(__dirname, 'templates', this.app.settings('type'), 'test-service.js'), {tests: this._tests});
};

Tests.prototype.migrate = function(models) {
	function register(modelName) {
		models.app.injector.register(modelName + 'Model', function() {
			return modelName;
		});
		models.app.models[modelName] = modelName;
		models.app.models.internals[modelName] = modelName;
	}

	if(typeof models.TestParticipant == 'undefined') {
		register('Test');
		register('TestParticipant');
		register('TestSession');
		register('TestVariant');

		util.inherits(TestParticipant, Model);
		models.addModelConstructor(TestParticipant);

		util.inherits(Test, Model);
		models.addModelConstructor(Test);

		util.inherits(TestSession, Model);
		models.addModelConstructor(TestSession);

		util.inherits(TestVariant, Model);
		models.addModelConstructor(TestVariant);
	}

	var authenticator = models.getAuthenticator();
	if(authenticator) {
		models.TestParticipant._addProperty('authenticator', [models.TestParticipant.BelongsTo(authenticator)]);
		authenticator._addProperty('testParticipant', [authenticator.HasOne(models.TestParticipant)]);
	}
};

Tests.prototype.setup = function(basePath) {
	if(basePath) {
		debug(path.join(basePath, 'tests'));

		this.app.requireDirSync(path.join(basePath, 'tests'));
	}

	this.migrate(this.app.models);

	Object.keys(this._constructors).forEach(function(key) {
		var testConstructor = this._constructors[key];

		var testMap = this.app.injector.execute(testConstructor);
		testMap.name = testConstructor.name;

		this.addTestMap(testMap);
	}, this);
};

Tests.prototype.addTestMap = function(testMap) {
	testMap.slug = inflection.dasherize(inflection.underscore(testMap.name)).toLowerCase();
	this._tests.push(testMap);

	if(testMap.controller) {
		var controllerNames = null;

		if(Array.isArray(testMap.controller)) {
			controllerNames = testMap.controller;
		}
		else {
			controllerNames = [testMap.controller];
		}

		controllerNames.forEach(function(controllerName) {
			var controller = this.app.controllers._controllers[controllerName];
			if(!controller) {
				throw new Error('Controller `' + controllerName + '` does not exist. Test `' + testMap.name + '` is trying to use this controller.');
			}

			if(typeof controller.tests == 'undefined') {
				controller.tests = [];
			}

			controller.tests.push(testMap);
		}, this);
	}

	var tester = new Tester(this.app, testMap);

	this.app.injector.register(testMap.name, function() {
		return tester;
	});

	this.app.post('/tests/' + testMap.slug, function(request) {
		var participantId = request.session.pid;
		if(!participantId) {
			participantId = uuid.v4();
			request.session.pid = participantId;
		}

		return tester.participate(participantId);
	});

	this.app.get('/tests/' + testMap.slug, function(request) {
		return tester.getVariant(request.session.pid)
			.then(function(variant) {
				if(variant) {
					return {
						variant: variant
					};
				}
				else {
					return null;
				}
			});
	});
};

Tests.prototype.createTests = function() {
	var result = Q.when(true);

	var app = this.app;

	this._tests.forEach(function(testMap) {
		result = result.then(function() {
			var whereMap = {};
			var setMap = {};

			if(testMap.id) {
				whereMap.id = testMap.id;
				setMap.name = testMap.name;
			}
			else {
				whereMap.name = testMap.name;
			}

			return app.models.Test.findOrCreate(whereMap, setMap)
				.then(function(test) {
					var result2 = Q.when(true);

					testMap.variants.forEach(function(variantName) {
						result2 = result2.then(function() {
							return app.models.TestVariant.findOrCreate({name: variantName, test: test}, {numberOfParticipants: 0});
						});
					});

					return result2;
				});
		});
	}, this);

	return result;
};
