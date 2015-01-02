/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var helper = require('./support/helper');

describe('injector', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Test() {
				this.name = [this.String, this.Required];
			}
			app.model(Test);
		};

		helper.createModels = function() {
			//
		};
	});

	it('can inject model', function() {
		var called = 0;

		function TestConstructor(TestModel) {
			assert.equal(TestModel, helper.app.models.Test);
			called++;
		}

		helper.app.injector.execute(TestConstructor, {});
		assert.equal(called, 1);
	});

	it('can inject self', function() {
		var called = 0;

		function TestConstructor(self) {
			assert.equal(self, this);
			called++;
		}

		helper.app.injector.execute(TestConstructor, {});
		assert.equal(called, 1);
	});
});
