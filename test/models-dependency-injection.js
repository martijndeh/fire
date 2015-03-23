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

		function MyModel(UserModel) {
			assert.equal(UserModel, helper.app.models.User);

			called++;
		}

		assert.equal(called, 0);
		helper.app.models.addModelConstructor(MyModel);
		assert.equal(called, 1);
	});

	it('throws error with invalid dependency', function() {
		function MyModel(Something) { //jshint ignore:line

		}

		var exception = null;
		try {
			helper.app.models._createModel(MyModel);
		}
		catch(e) {
			exception = e;
		}

		assert.notEqual(exception, null);
	});
});
