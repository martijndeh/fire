/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('model authorize passwordless', function() {
	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function User() {
				this.name = [this.String, this.Authenticate(true)];
			}
			helper.app.model(User);
		};

		helper.createModels = function() {
			helper.app.post('/test-authorize', function(request) {
				return helper.app.models.User
					.findOne({name: 'Martijn'})
					.then(function(user) {
						request.session.at = user.accessToken;
						return user;
					});
			});
			
			return helper.app.models.User
				.create({
					name: 'Martijn'
				});
		};
	});

	it('cannot authorize', function(done) {
		return request.agent(helper.app.HTTPServer.express)
			.post('/api/users/access-token')
			.send({name: 'Martijn', password: 'test'})
			.expect(404, done);
	});

	it('cannot create user', function(done) {
		return request.agent(helper.app.HTTPServer.express)
			.post('/api/users')
			.send({name: 'Martijn', password: 'test'})
			.expect(404, done);
	});

	it('cannot call authorize', function() {
		assert.throws(function() {
			helper.app.models.User
				.authorize({
					name: 'Martijn',
					password: 'test'
				});
		}, 'Model#authorize is not available on a password-less authenticator.');
	});

	it('can get me', function(done) {
		var agent = request.agent(helper.app.HTTPServer.express);

		agent
			.post('/test-authorize')
			.send()
			.expect(200, function() {
				agent
					.get('/api/users/me')
					.send()
					.expect(200, done);
			});
	});
});
