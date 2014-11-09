/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('schedulers', function() {
	var executed;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			executed = 0;

			function MyScheduler() {

			}
			helper.app.scheduler(MyScheduler);

			MyScheduler.prototype.run = function() {
				executed++;
			};
		};

		helper.createModels = function() {
			//
		};
	});

	it('can schedule task', function() {
		return helper.app.schedulers.startConsumingTasks()
			.then(function() {
				return helper.app.schedulers.startScheduler('MyScheduler');
			})
			.then(function() {
				return Q.delay(100);
			})
			.then(function() {
				assert.equal(executed > 0, true);
			});
	});
});
