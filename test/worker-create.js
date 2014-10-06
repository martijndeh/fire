/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

var Workers = require('./../lib/modules/workers');

describe('workers', function() {
	var called = 0;

	beforeEach(helper.beforeEach());
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
		};
	});

	it('can create worker', function() {
		// todo: check if workers.TestWorker exist
		assert.notEqual(helper.app.workers.TestWorker, null);
	});

	it('can publish message and consume', function(done) {
		assert.equal(called, 0);

		helper.app.workers.startConsuming();

		helper.app.workers.TestWorker.publishMessage('doSomething', []);

		setTimeout(function() {
			assert.equal(called, 1);
			done();
		}, 50);
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

		workers2.setup()
			.then(function() {
				return workers2.startConsuming();
			})
			.then(function() {
				helper.app.workers.TestWorker.doSomething();

				setTimeout(function() {
					workers2.close();

					assert.equal(called, 1);
					done();
				}, 50);
			});
	});
});
