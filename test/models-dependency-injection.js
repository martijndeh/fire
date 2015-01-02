/* global describe, before, beforeEach, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models dependency injection', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function User() {
				this.name = [this.String];
			}
			app.model(User);
		};

		helper.createModels = null;
	});

	it('can inject known dependecies', function() {
		var called = 0;

		function Test(UserModel) {
			assert.equal(UserModel, helper.app.models.User);

			called++;
		}

		var model = helper.app.models._createModel(Test);
		assert.notEqual(model, null);
		assert.equal(called, 1);
	});

	it('throws error with invalid dependency', function() {
		function Test(Something) { //jshint ignore:line

		}

		var exception = null;
		try {
			helper.app.models._createModel(Test);
		}
		catch(e) {
			exception = e;
		}

		assert.notEqual(exception, null);
	});
});
