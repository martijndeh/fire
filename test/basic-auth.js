/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('basic auth', function() {
	var accessToken, id;

	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function TestController() {
				//
			}
			helper.app.controller('/', TestController);

			function User() {
				this.name = [this.String, this.Authenticate];
			}
			helper.app.model(User);
		};

		helper.createModels = function() {
			return helper.app.models.User.create({
				name: 'Martijn',
				password: 'test'
			}).then(function(user) {
				accessToken = user.accessToken;
				id = user.id;
			});
		};
	});

	it('cannot get user without authentication', function(done) {
		return request(helper.app.HTTPServer.express)
			.get('/api/users/' + id)
			.send()
			.expect(401, function(error) {
				done(error);
			});
	});

	it('can get user', function(done) {
		return request(helper.app.HTTPServer.express)
			.get('/api/users/me')
			.set('Authorization', 'Basic ' + new Buffer(('Martijn:' + accessToken), 'utf8').toString('base64'))
			.send()
			.expect(200, function(error) {
				done(error);
			});
	});

	it('can get me', function(done) {
		return request(helper.app.HTTPServer.express)
			.get('/api/users/me')
			.set('Authorization', 'Basic ' + new Buffer(('Martijn:' + accessToken), 'utf8').toString('base64'))
			.send()
			.expect(200, function(error) {
				done(error);
			});
	});

	it('cannot get user with invalid credentials', function(done) {
		return request(helper.app.HTTPServer.express)
			.get('/api/users/me')
			.set('Authorization', 'Basic ' + new Buffer(('Invalid:' + accessToken), 'utf8').toString('base64'))
			.send()
			.expect(401, function(error) {
				done(error);
			});
	});
});
