/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');
var Q = require('q');

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
			.post('/api/users/access-token')
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
			.delete('/api/users/access-token')
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
			.delete('/api/users/access-token')
			.send()
			.expect(200, function(error) {
				assert.equal(null, error);
				agent
					.get('/api/users/me')
					.send()
					.expect(401, function() {
						agent
							.post('/api/users/access-token')
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

	describe('login tokens', function() {
		var userLoginToken = null;

		beforeEach(function(done) {
			helper.app.models.User.findOne({name: 'Martijn'})
				.then(function(user) {
					return user.getLoginToken();
				})
				.then(function(loginToken) {
					userLoginToken = loginToken;
					done();
				})
				.done();
		});

		it('can generate login token', function(done) {
			helper.app.models.User.findOne({name: 'Martijn'})
				.then(function(user) {
					return user.getLoginToken();
				})
				.then(function(loginToken) {
					assert.equal(loginToken.token.length, 128);

					done();
				})
				.done();
		});

		it('can use token', function(done) {
			request.agent(helper.app.HTTPServer.express)
				.get('/api/users/me?t=' + userLoginToken.token)
				.send()
				.expect(200, done);
		});

		it('cannot use expired token', function(done) {
			helper.app.models.User.findOne({name: 'Martijn'})
				.then(function(user) {
					var expiredDate = new Date();
					expiredDate.setFullYear(1988);

					return helper.app.models.UserLoginToken.create({authenticator: user, createdAt: expiredDate});
				})
				.then(function(expiredLoginToken) {
					request.agent(helper.app.HTTPServer.express)
						.get('/api/users/me')
						.send({t: expiredLoginToken.token})
						.expect(401, done);
				})
				.done();
		});

		it('will not create multiple tokens', function(done) {
			helper.app.models.User.findOne({name: 'Martijn'})
				.then(function(user) {
					return Q.all([user, user.getLoginToken()]);
				})
				.spread(function(user, token) {
					return Q.all([token, user.getLoginToken()]);
				})
				.spread(function(token1, token2) {
					assert.equal(token1.id, token2.id);
					done();
				})
				.done();
		});

		it('will create new token if expired', function(done) {
			helper.app.models.User.findOne({name: 'Martijn'})
				.then(function(user) {
					var expiredDate = new Date();
					expiredDate.setFullYear(1988);

					return helper.app.models.UserLoginToken.create({authenticator: user, createdAt: expiredDate})
						.then(function(expiredLoginToken) {
							return user.getLoginToken()
								.then(function(loginToken) {
									assert.notEqual(loginToken.id, expiredLoginToken.id);
									done();
								});
						});
				})
				.done();
		});
	});
});
