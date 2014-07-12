/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');

describe('models api overwrite', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Tester() {
				this.name = [this.String];
				this.accessControl = [this.Create(function() { return true; }), this.Read(function() { return true; }), this.Update(function() { return true; }), this.Delete(function() { return true; })];
			}
			app.model(Tester);

			Tester.prototype.createTester = function() {
				return this.create({name: 'Create'});
			};

			Tester.prototype.updateTester = function(whereMap) {
				return this.update(whereMap, {name: 'Update'});
			};

			/*
			Tester.prototype.deleteTester = function() {
				var error = new Error('Conflict');
				error.status = 409;
				throw error;
			};
			*/

			Tester.prototype.getTester = function() {
				return this.getOne({name: 'Test'});
			};

			Tester.prototype.getTesters = function() {
				return this.find({name: 'Test'});
			};
		};

		helper.createModels = function(app) {
			var result = Q.when(true);

			for(var i = 0, il = 20; i < il; i++) {
				result = result.then(function() {
					return app.models.Tester.create({name: 'Test'});
				});
			}

			return result;
		};
	});

	it('can create', function(done) {
		request(helper.app.express)
			.post('/api/testers')
			.send({
				name: 'Martijn'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.name, 'Create');
				done(error);
			});
	});

	it('can update', function(done) {
		request(helper.app.express)
			.put('/api/testers/1')
			.send({
				name: 'Martijn'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.name, 'Update');
				done(error);
			});
	});

	/*
	it('cannot delete', function(done) {
		request(helper.app.express)
			.delete('/api/testers/1')
			.send()
			.expect(409, function(error) {
				done(error);
			});
	});
	*/

	it('can find one', function(done) {
		request(helper.app.express)
			.get('/api/testers/1')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.name, 'Test');
				done(error);
			});
	});

	it('can find many', function(done) {
		request(helper.app.express)
			.get('/api/testers')
			.send({
				name: 'Martijn'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 20);
				done(error);
			});
	});
});
