/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('tasks', function() {
	var called = 0;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			called = 0;

			function TestTask() {
				//
			}
			helper.app.task(TestTask);

			TestTask.prototype.run = function() {
				called++;
			};
		};
		helper.createModels = null;
	});

	it('can run task', function() {
		assert.equal(called, 0);

		return helper.app.tasks.run(['TestTask'])
			.then(function() {
				assert.equal(called, 1);
			});
	});
});
