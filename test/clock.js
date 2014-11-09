/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var moment = require('moment');

describe('clock', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			//
		};

		helper.createModels = function() {
			//
		};
	});

	it('can schedule task', function() {
		var executed = 0;

		var task = helper.app.clock.addTask('*/2 * * * * *', 'MyTask', function() {
			executed++;
		});

		return task.start()
			.then(function() {
				return task.run();
			})
			.then(function() {
				assert.equal(executed > 0, true);
			});
	});

	it('creates initial task result when first started', function() {
		var executed = 0;

		var task = helper.app.clock.addTask('*/2 * * * * *', 'MyTask', function() {
			executed++;
		});

		return task.start()
			.then(function() {
				return helper.app.models.ClockTaskResult.find({name: 'MyTask'});
			})
			.then(function(clockTaskResults) {
				assert.equal(clockTaskResults.length, 1);

				var clockTaskResult = clockTaskResults[0];
				assert.notEqual(clockTaskResult.createdAt, null);
			});
	});

	it('creates task result when scheduled', function() {
		var executed = 0;

		var task = helper.app.clock.addTask('*/2 * * * * *', 'MyTask', function() {
			executed++;
		});

		return task.run()
			.then(function() {
				return helper.app.models.ClockTaskResult.find({name: 'MyTask'});
			})
			.then(function(clockTaskResults) {
				assert.equal(clockTaskResults.length, 1);

				var clockTaskResult = clockTaskResults[0];
				assert.notEqual(clockTaskResult.createdAt, null);
			});
	});

	it('immediately invoke task when skipped interval', function() {
		var executed = 0;

		var task = helper.app.clock.addTask('* 30 * * * *', 'MyTask', function() {
			executed++;
		});

		return helper.app.models.ClockTaskResult.create({name: 'MyTask', createdAt: moment().add(-1, 'days').toDate()})
			.then(function() {
				return task.checkSkippedTasks();
			})
			.then(function() {
				return helper.app.models.ClockTaskResult.find({name: 'MyTask'});
			})
			.then(function(clockTaskResults) {
				assert.equal(clockTaskResults.length, 2);
				assert.equal(executed, 1);
			});
	});

	it('will not invoke task when not skipped interval', function() {
		var executed = 0;

		var task = helper.app.clock.addTask('*/2 * * * * *', 'MyTask', function() {
			executed++;
		});

		return task.run()
			.then(function() {
				return Q.delay(100);
			})
			.then(function() {
				return task.checkSkippedTasks();
			})
			.then(function() {
				return task.checkSkippedTasks();
			})
			.then(function() {
				return helper.app.models.ClockTaskResult.find({name: 'MyTask'});
			})
			.then(function(clockTaskResults) {
				assert.equal(clockTaskResults.length, 1);
				assert.equal(executed, 1);
			});
	});
});
