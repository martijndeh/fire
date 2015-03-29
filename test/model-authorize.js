/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('model authorize', function() {
	var agent = null;

	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function User() {
				this.name = [this.String, this.Authenticate];
			}
			helper.app.model(User);
		};

		helper.createModels = function() {
			return helper.app.models.User.create({
				name: 'Martijn',
				password: 'test'
			});
		};
	});

	beforeEach(function(done) {
		agent = request.agent(helper.app.HTTPServer.express);
		agent
			.post('/api/users/authorize')
			.send({name: 'Martijn', password: 'test'})
			.expect(200, done);
	});

	it('is authorized', function(done) {
		return agent
			.get('/api/users/me')
			.send()
			.expect(200, done);
	});

	it('can sign out', function(done) {
		return agent
			.post('/api/users/sign-out')
			.send()
			.expect(200, function(error) {
				assert.equal(null, error);
				agent
					.get('/api/users/me')
					.send()
					.expect(401, done);
			});
	});

	it('can sign out and sign back in', function(done) {
		return agent
			.post('/api/users/sign-out')
			.send()
			.expect(200, function(error) {
				assert.equal(null, error);
				agent
					.get('/api/users/me')
					.send()
					.expect(401, function() {
						agent
							.post('/api/users/authorize')
							.send({name: 'Martijn', password: 'test'})
							.expect(200, function() {
								agent
									.get('/api/users/me')
									.send()
									.expect(200, done);
							});
					});
			});
	});
});
