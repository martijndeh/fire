/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('model update function', function() {
	var agent = null;

	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function MyTest() {
				this.name = [this.String, this.Required];
				this.value = [this.Integer, this.Required];
			}
			helper.app.model(MyTest);

			helper.app.service(function MyService() {
				this.value = function() {
					return 456;
				};
			});
		};

		helper.createModels = function() {
			return helper.app.models.MyTest.create([{
				name: 'Martijn',
				value: 123
			}, {
				name: 'Martijn 2',
				value: 124
			}]);
		};
	});

	it('can update', function() {
		return helper.app.models.MyTest.updateFunction({name: 'Martijn'}, function(myTest, MyService) {
			myTest.value = MyService.value();
		}).then(function() {
			return helper.app.models.MyTest.findOne({name: 'Martijn'});
		}).then(function(myTest) {
			assert.equal(myTest.value, 456);
		}).then(function() {
			return helper.app.models.MyTest.findOne({name: 'Martijn 2'});
		}).then(function(myTest) {
			assert.equal(myTest.value, 124);
		});
	});
});
