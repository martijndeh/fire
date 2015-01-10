/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('forgot password', function() {
	var onForgotPasswordCalled = false;
	var onResetPasswordCalled = false;
	var resetPasswordInstance = null;
	var userID = null;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function User() {
				this.email = [this.String, this.Authenticate];

			}
			helper.app.model(User);

			User.prototype.onForgotPassword = function(resetPassword) { //jshint ignore:line
				onForgotPasswordCalled = true;
				resetPasswordInstance = resetPassword;
			};

			User.prototype.onResetPassword = function() {
				onResetPasswordCalled = true;
			};
		};
		helper.createModels = function() {
			onForgotPasswordCalled = false;
			onResetPasswordCalled = false;
			resetPasswordInstance = null;
			userID = null;

			return helper.app.models.User.create({
				email: 'martijn@nodeonfire.org',
				password: 'njitram'
			})
			.then(function(user) {
				userID = user.id;
			});
		};
	});



	it('can call forgot password', function(done) {
		// We authorize. This should set a session variable.
		request(helper.app.HTTPServer.express)
			.post('/api/users/forgot-password')
			.send({email: 'martijn@nodeonfire.org'})
			.expect(200, function(error) {
				assert.notEqual(helper.app.models.UserResetPassword, null);
				assert.equal(error, null);
				done(error);
			});
	});

	it('cannot call forgot password when already authorized', function(done) {
		var agent = request.agent(helper.app.HTTPServer.express);

		agent
			.post('/api/users/authorize')
			.send({email: 'martijn@nodeonfire.org', password: 'njitram'})
			.expect(200, function(error) {
				assert.equal(error, null);

				agent
					.post('/api/users/forgot-password')
					.send({email: 'martijn@nodeonfire.org'})
					.expect(403, function(error2) {
						done(error2);
					});
			});
	});

	it('can call forgot password on non-existing account and receive valid response', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/users/forgot-password')
			.send({email: 'this user does not exist'})
			.expect(200, function(error) {
				assert.equal(error, null);
				assert.equal(onForgotPasswordCalled, false);
				done(error);
			});
	});

	it('can reset password after forgot password', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/users/forgot-password')
			.send({email: 'martijn@nodeonfire.org'})
			.expect(200, function(error) {
				assert.equal(error, null);
				assert.equal(onForgotPasswordCalled, true);
				assert.notEqual(resetPasswordInstance, null);

				request(helper.app.HTTPServer.express)
					.post('/api/users/reset-password')
					.send({
						resetToken: resetPasswordInstance.token,
						password: 'test'
					})
					.expect(200, function(error2) {
						assert.equal(error2, null);
						assert.equal(onResetPasswordCalled, true);

						helper.app.models.User.findOne({email: 'martijn@nodeonfire.org'})
							.then(function(user) {
								return user.validateHash('password', 'test');
							})
							.then(function(result) {
								assert.equal(result, true);
								return helper.app.models.UserResetPassword.findOne({});
							})
							.then(function(resetPassword) {
								assert.equal(resetPassword, null);
								done();
							})
							.done();
					});
			});
	});

	it('cannot reset password without forgot password', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/users/reset-password')
			.send({
				resetToken: '',
				password: 'test'
			})
			.expect(404, function(error) {
				done(error);
			});
	});

	it('cannot create user reset password instance', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/user-reset-passwords')
			.send({
				resetToken: 'test',
				password: 'test'
			})
			.expect(404, function(error) {
				done(error);
			});
	});

	it('cannot create user reset password instance in user', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/users/' + userID + '/resetPassword')
			.send({
				resetToken: 'test',
				password: 'test'
			})
			.expect(404, function(error) {
				done(error);
			});
	});
});
