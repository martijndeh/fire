/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var Workers = require('./../lib/modules/workers');
var fire = require('./..');

describe('workers', function() {
	var called = 0;

	beforeEach(helper.beforeEach({isMaster: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			called = 0;

			function TestWorker() {
				//
			}
			helper.app.worker(TestWorker);

			TestWorker.prototype.doSomething = function() {
				called++;
			};

			var app2 = fire.app('test', 'another-app', {});
			function AnotherWorker() {

			}
			app2.worker(AnotherWorker);

			AnotherWorker.prototype.doSomethingCool = function() {
				called++;
			};

			helper.app.workers.swizzleExternalMethods();
		};
		helper.createModels = null;
	});

	it('can create worker', function() {
		// todo: check if workers.TestWorker exist
		assert.notEqual(helper.app.workers.TestWorker, null);
	});

	it('can publish message and consume', function() {
		assert.equal(called, 0);

		return helper.app.workers.startConsumingTasks(['TestWorker'])
			.then(function() {
				return helper.app.workers.TestWorker.createTask('doSomething', []);
			})
			.then(function() {
				return Q.delay(50);
			})
			.then(function() {
				assert.equal(called, 1);
			});
	});

	it('can swizzle worker methods', function(done) {
		assert.equal(called, 0);

		helper.app.workers.swizzleMethods();

		var workers2 = new Workers(helper.app);

		function TestWorker() {
			//
		}
		workers2.worker(TestWorker);

		TestWorker.prototype.doSomething = function() {
			called++;
		};

		workers2.setup();

		return workers2.startConsumingTasks(['TestWorker'])
			.then(function() {
				helper.app.workers.TestWorker.doSomething();

				setTimeout(function() {
					workers2.stop();

					assert.equal(called, 1);
					done();
				}, 50);
			});
	});

	describe('another app', function() {
		it('worker exists in first app', function() {
			assert.notEqual(helper.app.workers.AnotherWorker, null);
		});
	});
});
