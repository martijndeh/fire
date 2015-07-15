/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('models count', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Tester() {
				this.name = [this.String];
				this.value = [this.Integer];
			}
			app.model(Tester);

			Tester.prototype.accessControl = function() {
				return {
					canRead: function() {
						return true;
					}
				};
			};
		};

		helper.createModels = function() {
			return helper.app.models.Tester.create([{
				name: 'Tester 1',
				value: 1
			}, {
				name: 'Tester 2',
				value: 2
			}, {
				name: 'Tester 3',
				value: 2
			}]);
		};
	});

	it('can count all testers', function() {
		return helper.app.models.Tester.count()
			.then(function(numberOfTesters) {
				assert.equal(numberOfTesters, 3);
			});
	});

	it('can count with where', function() {
		return helper.app.models.Tester.count({value: 2})
			.then(function(numberOfTesters) {
				assert.equal(numberOfTesters, 2);
			});
	});

	it('can count all over http', function(done) {
		request(helper.app.HTTPServer.express)
			.get('/api/testers/_count')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body, 3);
				done(error);
			});
	});

	it('can count with where over http', function(done) {
		request(helper.app.HTTPServer.express)
			.get('/api/testers/_count?value=2')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body, 2);
				done(error);
			});
	});

	it('can use exists if exists', function() {
		return helper.app.models.Tester.exists({value: 2})
			.then(function(exists) {
				assert.equal(exists, true);
			});
	});

	it('can use exists if not exists', function() {
		return helper.app.models.Tester.exists({value: 4})
			.then(function(exists) {
				assert.equal(exists, false);
			});
	});

	it('can use exists without where', function() {
		return helper.app.models.Tester.exists()
			.then(function(exists) {
				assert.equal(exists, true);
			});
	});
});
