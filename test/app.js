/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('app', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	describe('run', function() {
		var called = false;

		before(function() {
			helper.setup = function() {
				helper.app.run(function() {
					called = true;
				});
			};
			helper.createModels = null;
		});

		it('can run app', function(done) {
			assert.equal(called, true);
			done();
		});
	});
});
