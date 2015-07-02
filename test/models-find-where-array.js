/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find where array', function() {
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
			return helper.app.models.Tester.create([{
				name: 'Tester 1'
			}, {
				name: 'Tester 2'
			}, {
				name: 'Tester 3'
			}]);
		};
	});

	it('can find with 1 value', function() {
		return helper.app.models.Tester.find({name: ['Tester 1']})
			.then(function(testers) {
				assert.equal(testers.length, 1);
			});
	});

	it('cannot find with empty array', function() {
		return helper.app.models.Tester.find({name: []})
			.then(function(testers) {
				assert.equal(testers.length, 0);
			});
	});

	it('cannot find with empty array', function() {
		return helper.app.models.Tester.find({name: {$not:[]}})
			.then(function(testers) {
				assert.equal(testers.length, 3);
			});
	});

	it('can find with $not operator and array', function() {
		return helper.app.models.Tester.find({name:{$not: ['Tester 1']}})
			.then(function(testers) {
				assert.equal(testers.length, 2);
				assert.notEqual(testers[0].name, 'Tester 1');
				assert.notEqual(testers[1].name, 'Tester 1');
			});
	});
});
