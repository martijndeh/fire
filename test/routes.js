/* global describe, before, it, after */
var fire = require('..');
var Config = require('./../lib/helpers/config');

var path =  require('path');
var request = require('supertest');
var assert = require('assert');

describe('controller routes', function() {
	var app = null;
	var server = null;

	after(function() {
		return fire.stop();
	});

	before(function(done) {
		Config.basePath = path.dirname(__dirname);

		app = fire.app('routes', {});

		// Let's create some controllers
		function ApiController() {}
		app.controller(ApiController);

		ApiController.prototype.basePathComponents = ['1', 'api'];

		ApiController.prototype.configure = function() {
			
		};

		ApiController.prototype.before = function() {
			// TODO: check if before is called
		};

		ApiController.prototype.getUsers = function() {
			return [];
		};

		ApiController.prototype.getUser = function(id) {
			return {
				id: id
			};
		};

		ApiController.prototype.createUser = function() {
			return {
				id: 123
			};
		};

		ApiController.prototype.updateUser = function(id) {
			return {
				id: id
			};
		};

		fire.start()
			.then(function(s) {
				server = s;

				done();
			})
			.done();
	});

	it('cannot find route', function(done) {
		request(app.HTTPServer.express)
			.get('/404')
			.expect(404, done);
	});

	it('can find get route', function(done) {
		request(app.HTTPServer.express)
			.get('/1/api/users')
			.expect(200, done);
	});

	it('can find get route with argument', function(done) {
		request(app.HTTPServer.express)
			.get('/1/api/users/123')
			.expect(200, done);
	});

	it('can find get route with correct argument', function(done) {
		request(app.HTTPServer.express)
			.get('/1/api/users/10')
			.expect(200, function(error, response) {
				assert.equal(response.text, '{"id":"10"}');
				done();
			});
	});

	it('can do post for create route', function(done) {
		request(app.HTTPServer.express)
			.post('/1/api/users')
			.expect(200, done);
	});

	it('can do put for update route', function(done) {
		request(app.HTTPServer.express)
			.put('/1/api/users/123')
			.expect(200, done);
	});
});
