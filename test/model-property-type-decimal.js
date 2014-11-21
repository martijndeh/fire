/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('model property type decimal', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Test() {
				this.name = [this.String];
				this.value = [this.Decimal(4, 2)];
			}
			app.model(Test);
		};

		helper.createModels = function(app) {
			return app.models.Test.create([{
				name: 'Test 1',
				value: 1.12
			}]);
		};
	});

	it('can create decimal', function() {
		return helper.app.models.Test.find({name: 'Test 1'}, {})
			.then(function(events) {
				assert.equal(events.length, 1);
				assert.equal(events[0].value, 1.12);
			});
	});
});
