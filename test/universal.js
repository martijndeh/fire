/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('universal', function() {
	var called;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			called = 0;

			helper.app.service(function MyService() {
				this.someMethod = function() {
					called++;
				};
			});

			helper.app.factory(function MyFactory() {
				return {
					someMethod: function() {
						called++;
					}
				};
			});
		};

		helper.createModels = function() {
			//
		};
	});

	it('can use service', function() {
		helper.app.injector.execute(function(MyService) {
			assert.notEqual(typeof MyService, 'undefined');
			assert.notEqual(typeof MyService.someMethod, 'undefined');

			MyService.someMethod();

			assert.equal(called, 1);
		});
	});

	it('can use factory', function() {
		helper.app.injector.execute(function(MyFactory) {
			assert.notEqual(typeof MyFactory, 'undefined');
			assert.notEqual(typeof MyFactory.someMethod, 'undefined');

			MyFactory.someMethod();

			assert.equal(called, 1);
		});
	});
});
