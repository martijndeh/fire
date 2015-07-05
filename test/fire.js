/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('fire', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {

		};

		helper.createModels = function() {
			//
		};
	});

	it('can tell sides', function() {
		helper.app.injector.execute(function(fire) {
			assert.equal(fire.isServer(), true);
			assert.equal(fire.isClient(), false);
		});
	});
});
