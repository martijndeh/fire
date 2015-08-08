/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var Workers = require('./../lib/modules/workers');
var fire = require('./..');

describe('workers', function() {
	var called = 0;
	var runCalled = 0;

	beforeEach(helper.beforeEach({isMaster: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			called = 0;
			runCalled = 0;

			function TestWorker() {
				//
			}
			helper.app.worker(TestWorker);

			TestWorker.prototype.doSomething = function() {
				called++;
			};

			var app2 = fire('test', 'another-app', {});
			function AnotherWorker() {

			}
			app2.worker(AnotherWorker);

			AnotherWorker.prototype.doSomethingCool = function() {
				called++;
			};

			helper.app.worker(function ContinuousWorker() {
				this.run = function() {
					runCalled++;
				};
			});


			helper.app.workers.swizzleExternalMethods();
		};
		helper.createModels = null;
	});

	it('can return all worker names', function() {
		var startingWorkerNames = helper.app.workers.startingWorkerNames({workers:true});
		assert.equal(startingWorkerNames.length, 2);
		assert.equal(startingWorkerNames[0], 'TestWorker');
		assert.equal(startingWorkerNames[1], 'ContinuousWorker');
	});

	it('can return one starting worker name', function() {
		var startingWorkerNames = helper.app.workers.startingWorkerNames({worker:'TestWorker'});
		assert.equal(startingWorkerNames.length, 1);
		assert.equal(startingWorkerNames[0], 'TestWorker');
	});

	it('can create worker', function() {
		// todo: check if workers.TestWorker exist
		assert.notEqual(helper.app.workers.TestWorker, null);
	});

	it('is task based', function() {
		assert.equal(helper.app.workers.TestWorker.isTaskBased(), true);
	});

	it('is continuous worker', function() {
		assert.equal(helper.app.workers.ContinuousWorker.isContinuous(), true);
	});

	it('can publish message and consume', function() {
		assert.equal(called, 0);

		return helper.app.workers.startWorkers(['TestWorker'])
			.then(function() {
				return helper.app.workers.TestWorker.createTask(helper.app.workers.getMessageQueue(), 'TestWorker', 'doSomething', []);
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

		return workers2.startWorkers(['TestWorker'])
			.then(function() {
				helper.app.workers.TestWorker.doSomething();

				setTimeout(function() {
					workers2.stop();

					assert.equal(called, 1);
					done();
				}, 50);
			});
	});

	it('can start continuous worker', function() {
		helper.app.workers.startWorkers(['ContinuousWorker'])
			.then(function() {
				assert.equal(runCalled, 1);
			});
	});

	describe('another app', function() {
		it('worker exists in first app', function() {
			assert.notEqual(helper.app.workers.AnotherWorker, null);
		});
	});
});
