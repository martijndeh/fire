/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find $or', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Tester() {
				this.name = [this.String];
				this.value = [this.Integer];
			}
			app.model(Tester);
		};

		helper.createModels = function() {
			return helper.app.models.Tester.create([{
				name: 'Tester 1',
				value: 1,
			}, {
				name: 'Tester 2',
				value: 2
			}, {
				name: 'Tester 3',
				value: 3
			}]);
		};
	});

	it('can find with or in property', function() {
		return helper.app.models.Tester.find({name: {$or: ['Tester 1', 'Tester 2']}})
			.then(function(testers) {
				assert.equal(testers.length, 2);
			});
	});

	it('can find with or and normal', function() {
		return helper.app.models.Tester.find({name: {$or: ['Tester 2', 'Tester 1']}, value: 2})
			.then(function(testers) {
				assert.equal(testers.length, 1);
			});
	});

	it('can find with or', function() {
		return helper.app.models.Tester.find({$or: [{name: 'Tester 2'}, {value: 1}]})
			.then(function(testers) {
				assert.equal(testers.length, 2);
			});
	});

	it('can find with or using 3 statements', function() {
		return helper.app.models.Tester.find({$or: [{name: 'Tester 2'}, {value: 1}, {name: 'Tester 3'}]})
			.then(function(testers) {
				assert.equal(testers.length, 3);
			});
	});

	it('can find with or and array', function() {
		return helper.app.models.Tester.find({$or: [{name: ['Tester 2', 'Tester 1']}, {value: 1}]})
			.then(function(testers) {
				assert.equal(testers.length, 2);
			});
	});

	it('can find with or and normal statement', function() {
		return helper.app.models.Tester.find({$or: [{name: 'Tester 1'}, {name: 'Tester 2'}], value: 2})
			.then(function(testers) {
				assert.equal(testers.length, 1);
			});
	});
});
