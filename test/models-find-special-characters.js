/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find special characters', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Tester() {
				this.name = [this.String];
			}
			app.model(Tester);
		};

		helper.createModels = function() {
			//
		};
	});

	it('can limit find', function() {
		var name = 'A name with ?';

		return helper.app.models.Tester.findOrCreate({name: name}, {name: name})
			.then(function() {
				return helper.app.models.Tester.findOrCreate({name: name}, {name: name});
			})
			.then(function() {
				return helper.app.models.Tester.findOne({name: name});
			})
			.then(function(row) {
				assert.notEqual(row, null);
			});
	});
});
