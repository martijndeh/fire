/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('model property type decimal', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Shoe() {
				this.name = [this.String];
				this.value = [this.Decimal(4, 2)];
			}
			app.model(Shoe);
		};

		helper.createModels = function(app) {
			return app.models.Shoe.create([{
				name: 'Test 1',
				value: 1.12
			}]);
		};
	});

	it('can create decimal', function() {
		return helper.app.models.Shoe.find({name: 'Test 1'}, {})
			.then(function(shoes) {
				assert.equal(shoes.length, 1);
				assert.equal(shoes[0].value, 1.12);
			});
	});
});
