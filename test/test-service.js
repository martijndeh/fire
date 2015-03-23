/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');
var uuid = require('node-uuid');
var Q = require('q');

describe('tests', function() {
	beforeEach(helper.beforeEach({
		migrate: true
	}));
	afterEach(helper.afterEach());

	var userID = uuid.v4();
	var agent = null;

	function test(name, callback) {
		it(name, function(done) {
			var ret = helper.app.injector.call(callback, {done: done});

			if(typeof ret != 'undefined') {
				Q.when(ret)
					.then(function() {
						done();
					})
					.catch(function(error) {
						done(error);
					})
					.done();
			}
			else {
				// `done` is assumed tob e called by the test.
			}
		});
	}

	before(function() {
		helper.setup = function(app) {
			agent = request.agent(app.HTTPServer.express);

			app.test(function ColorOfAButtonTest() {
				return {
					id: 'c1ebc621-7051-4365-82af-f6b608ccf4e7',
					controller: 'TestController',
					variants: ['A', 'B']
				};
			});

			app.test(function SizeOfHeaderTest() {
				return {
					controller: 'Test2Controller',
					variants: ['A', 'B', 'C', 'D And a longer name']
				};
			});

			app.controller('/test-1', function TestController() {

			});

			app.controller('/test-2', function Test2Controller() {

			});
		};

		helper.createModels = function() {
			//
		};
	});

	it('creates slugs', function() {
		var testMap = helper.app.controllers._controllers.TestController.tests[0];
		assert.equal(testMap.slug, 'color-of-a-button-test');

		testMap = helper.app.controllers._controllers.Test2Controller.tests[0];
		assert.equal(testMap.slug, 'size-of-header-test');
	});

	it('creates tests', function() {
		return helper.app.models.Test.find({}, {orderBy: {name: 1}})
			.then(function(tests) {
				assert.equal(tests.length, 2);
				assert.equal(tests[0].id, 'c1ebc621-7051-4365-82af-f6b608ccf4e7');
				assert.equal(tests[0].name, 'ColorOfAButtonTest');
				assert.equal(tests[1].name, 'SizeOfHeaderTest');
			});
	});

	it('creates variants', function() {
		return helper.app.models.Test.findOne({name: 'SizeOfHeaderTest'})
			.then(function(test) {
				return helper.app.models.TestVariant.find({test: test}, {orderBy: {name: 1}});
			})
			.then(function(testVariants) {
				assert.equal(testVariants.length, 4);
				assert.equal(testVariants[0].name, 'A');
				assert.equal(testVariants[1].name, 'B');
				assert.equal(testVariants[2].name, 'C');
				assert.equal(testVariants[3].name, 'D And a longer name');
			});
	});

	test('creates dependencies', function(ColorOfAButtonTest, SizeOfHeaderTest, done) { //jshint ignore:line
		done();
	});

	test('can participate', function(ColorOfAButtonTest, TestSessionModel) {
		return ColorOfAButtonTest.participate(userID)
			.then(function() {
				return TestSessionModel.find();
			})
			.then(function(sessions) {
				assert.equal(sessions.length, 1);
				assert.equal(sessions[0].variant, 'A');
			});
	});

	test('cannot participate twice', function(ColorOfAButtonTest, TestSessionModel) {
		return ColorOfAButtonTest.participate(userID)
			.then(function() {
				return ColorOfAButtonTest.participate(userID);
			})
			.then(function() {
				return TestSessionModel.find();
			})
			.then(function(sessions) {
				assert.equal(sessions.length, 1);
				assert.equal(sessions[0].variant, 'A');
			});
	});

	test('can participate 4 times', function(SizeOfHeaderTest, TestSessionModel, TestVariantModel) {
		var count = 4;

		var result = Q.when(true);

		while(count--) {
			result = result.then(function() {
				return SizeOfHeaderTest.participate(uuid.v4());
			}); //jshint ignore:line
		}

		return result
			.then(function() {
				return TestSessionModel.find();
			})
			.then(function(sessions) {
				assert.equal(sessions.length, 4);

				return TestVariantModel.find({test: sessions[0].test});
			})
			.then(function(variants) {
				assert.equal(variants.length, 4);

				assert.equal(variants[0].numberOfParticipants, 1);
				assert.equal(variants[1].numberOfParticipants, 1);
				assert.equal(variants[2].numberOfParticipants, 1);
				assert.equal(variants[3].numberOfParticipants, 1);
			});
	});

	test('can participate 18 times', function(SizeOfHeaderTest, TestSessionModel, TestVariantModel) {
		var count = 18;

		var result = Q.when(true);

		while(count--) {
			result = result.then(function() {
				return SizeOfHeaderTest.participate(uuid.v4());
			}); //jshint ignore:line
		}

		return result
			.then(function() {
				return TestSessionModel.find();
			})
			.then(function(sessions) {
				assert.equal(sessions.length, 18);

				return TestVariantModel.find({test: sessions[0].test}, {orderBy: {name: 1}});
			})
			.then(function(variants) {
				assert.equal(variants.length, 4);

				assert.equal(variants[0].numberOfParticipants, 5);
				assert.equal(variants[1].numberOfParticipants, 5);
				assert.equal(variants[2].numberOfParticipants, 4);
				assert.equal(variants[3].numberOfParticipants, 4);
			});
	});

	describe('http', function() {
		test('can participate', function(done) {
			agent
				.post('/tests/color-of-a-button-test')
				.send()
				.expect(200)
				.end(function(error, response) {
					assert.equal(response.body.variant, 'A');
					done(error);
				});
		});

		test('can participate & get variant', function(done) {
			agent
				.post('/tests/color-of-a-button-test')
				.send()
				.expect(200)
				.end(function(error) {
					if(error) {
						done(error);
					}
					else {
						agent.get('/tests/color-of-a-button-test')
							.send()
							.expect(200)
							.end(function(error2, response) {
								if(error) {
									done(error2);
								}
								else {
									assert.equal(response.body.variant, 'A');
									done();
								}
							});
					}
				});
		});

		test('cannot get variant without participating', function(done) {
			agent
				.get('/tests/color-of-a-button-test')
				.send()
				.expect(404)
				.end(function(error) {
					done(error);
				});
		});
	});
});
