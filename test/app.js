/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('app', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	describe('configure', function() {
		var called = false;

		before(function() {
			helper.setup = function() {
				helper.app.configure(function() {
					assert.equal(this, helper.app);
					called = true;
				});
			};
		});

		it('can configure app', function(done) {
			assert.equal(called, true);
			done();
		});
	});
});
