/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var helper = require('./support/helper');
var request = require('supertest');

describe('middleware', function() {
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
			return helper.app.models.Test.create({name: 'Test 1'});
		};
	});

	it('can inject parameters', function(done) {
		helper.app.get('/test/:id', function(id) {
			assert.equal(id, 123);
			return {};
		});

		request(helper.app.HTTPServer.express)
			.get('/test/123')
			.expect(200, done);
	});

	it('can get return value', function(done) {
		helper.app.get('/tests', function(TestModel) {
			return TestModel.find({});
		});

		request(helper.app.HTTPServer.express)
			.get('/tests')
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 1);
				assert.equal(response.body[0].name, 'Test 1');
				done(error);
			});
	});

	it('can receive an error', function(done) {
		helper.app.get('/tests', function() {
			var error = new Error();
			error.status = 500;
			throw error;
		});

		request(helper.app.HTTPServer.express)
			.get('/tests')
			.expect(500, function(error) {
				done(error);
			});
	});
});
