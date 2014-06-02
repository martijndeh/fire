var fire = require('..');
var Config = require('./../lib/helpers/config');

var should = require('chai').should()
var path =  require('path');
var request = require('supertest')
var assert = require('assert');

describe('connections', function() {
	var app = null;
	var server = null;

	after(function(done) {
		if(server) {
			server.close();
		}

		done();
	})

	before(function(done) {
		Config.basePath = path.dirname(__dirname);

		app = fire.app();
		app.run()
			.then(function(s) {
				server = s;

				// Let's create some controllers
				function ApiController() {}
				ApiController.prototype.before = function() {
					// TODO: check if before is called
				}
				fire.controller(ApiController);

				ApiController.prototype.getTest = function(test) {
					return {
						title: 'Hello, test.'
					};
				}

				ApiController.prototype.getTest2 = function(test, $id) {
					return {
						id: $id
					};
				}

				ApiController.prototype.createTest = function(tests) {
					return {
						id: 123
					}
				}

				ApiController.prototype.updateTest = function(tests, $id) {
					return {
						id: $id
					};
				}

				app.controllers.loadClass(ApiController, Config.basePath + '/controllers/1/api/controller.js', null);

				done();
			})
			.done();
	})

	it('respond with 404', function(done) {
		request(app.server)
			.get('/404')
			.expect(404, done)
	})

	it('respond with 200', function(done) {
		request(app.server)
			.get('/1/api/test')
			.expect(200, done)
	})

	it('respond with application/json', function(done) {
		request(app.server)
			.get('/1/api/test')
			.expect(200, done);
	})

	it('should call before', function(done) {
		request(app.server)
			.get('/1/api/test')
			.expect(200, function() {
				// TODO: check if before is called

				done();
			});
	});

	it('should match parameter', function(done) {
		request(app.server)
			.get('/1/api/test/10')
			.expect(200, function(error, response) {
				assert.equal(response.text, '{"id":"10"}');
				done();
			})
	});

	it('should map create to post', function(done) {
		request(app.server)
			.post('/1/api/tests')
			.expect(200, done);
	});

	it('should map update to put', function(done) {
		request(app.server)
			.put('/1/api/tests/123')
			.expect(200, done);
	})
})
