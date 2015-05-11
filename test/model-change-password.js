/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('model change password', function() {
	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	var user = null;
	before(function() {
		helper.setup = function() {
			function User() {
				this.email = [this.String, this.Authenticate];

			}
			helper.app.model(User);
		};

		helper.createModels = function() {
			user = null;

			return helper.app.models.User.create({
				email: 'martijn@nodeonfire.org',
				password: 'njitram'
			})
			.then(function(newUser) {
				user = newUser;
			});
		};
	});

	helper.test('can change password', function(UserModel) {
		var password = user.password;
		var passwordSalt = user.passwordSalt;
		var accessToken = user.accessToken;

		return user.changePassword('njitram', 'different_password', 'different_password').then(function(updatedUser) {
			assert.notEqual(updatedUser.password, password);
			assert.notEqual(updatedUser.passwordSalt, passwordSalt);
			assert.notEqual(updatedUser.accessToken, accessToken);

			return UserModel.authorize({email: 'martijn@nodeonfire.org', password: 'different_password'});
		}).then(function(otherUser) {
			assert.notEqual(otherUser, null);

			return UserModel.authorize({email: 'martijn@nodeonfire.org', password: 'njitram'}).then(function() {
				assert.equal(true, false);
			}).catch(function(error) {
				assert.notEqual(error, null);
			});
		});
	});

	helper.test('cannot change password with invalid current password', function() {
		return user.changePassword('not the correct password', 'different_password').then(function() {
			assert.equal(true, false);
		}).catch(function(error) {
			assert.notEqual(error, null);
		});
	});

	helper.test('can change password over http', function(done) {
		var agent = request.agent(helper.app.HTTPServer.express);

		agent
			.post('/api/users/access-token')
			.send({email: 'martijn@nodeonfire.org', password: 'njitram'})
			.expect(200, function(error) {
				assert.equal(error, null);

				agent
					.put('/api/users/password')
					.send({currentPassword: 'njitram', newPassword: 'test', confirmPassword: 'test'})
					.expect(200, done);
			});
	});
});
