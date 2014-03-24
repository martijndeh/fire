var fire = require('..');
var Config = require('../lib/config');

var should = require('chai').should()
var path =  require('path');
var request = require('supertest')

//todo: test w/https://www.npmjs.org/package/supertest
//json responses, matches, etc

describe('connections', function() {
	var app;

	before(function() {
		Config.basePath = path.dirname(__dirname);

		app = fire();
		app.run();

		// Let's create some controllers
		function ApiController() {}
		ApiController.prototype.contentType = 'application/json';
		ApiController.prototype.render = function(filePath, objects) {
			return JSON.stringify(objects);
		}

		ApiController.prototype.getTest = function(test) {
			return {
				title: 'Hello, test.'
			};
		}

		// TODO: implement Controllers#addController to easier add controllers

		app.controllers.loadClass(ApiController, Config.basePath + '/controllers/1/api/controller.js', null);
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


})
