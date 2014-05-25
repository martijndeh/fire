var fire = require('..');

var path = require('path');
var request = require('supertest');

var Controllers = process.env.NODE_COV ? require('../lib-cov/controllers') : require('../lib/controllers');
var Config = process.env.NODE_COV ? require('../lib-cov/config') : require('../lib/config');

var should = require('chai').should()

describe('routes', function() {
	var app;

	afterEach(function() {
		app = null;
	})

	beforeEach(function() {
		app = fire.app();
		Config.basePath = path.dirname(__dirname);
	})

	it('should create index route', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function() {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/$/i');
		route.methods['get'].should.equal(true);

		done();
	})

	it('should create route in sub-directory', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function() {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/sub/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/sub(?:/)?$/i');
		route.methods['get'].should.equal(true);

		done();
	})

	it('should create route in sub-sub-directory', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function() {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/sub1/sub2/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/sub1/sub2(?:/)?$/i');
		route.methods['get'].should.equal(true);

		done();
	})

	it('should create route for post verb', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.postIndex = function() {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/$/i');
		route.methods['post'].should.equal(true);

		done();
	})

	it('should create route for with 1 param', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function($test) {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/([^/]+)(?:/)?$/i')
		route.methods['get'].should.equal(true);
		
		done();
	})

	it('should create route for with 2 params', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function($test1, $test2) {}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var stack = app.server._router.stack;
		var route = stack[stack.length - 1].route;

		route.path.toString().should.equal('/^/([^/]+)/([^/]+)(?:/)?$/i');
		route.methods['get'].should.equal(true);

		done();
	})

	it('should create route with 1 matching param', function(done) {
		function TestController() {}
		fire.controller(TestController);

		TestController.prototype.getIndex = function($test1) {
			$test1.should.equal('val1');

			return {
				test1: $test1
			};
		}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		request(app.server)
			.get('/val1')
			.expect(200, function(error, response) {
				response.text.should.equal('{"test1":"val1"}');
				done();
			});
	});

	it('should create route with 2 matching params', function(done) {
		function TestController() {}
		fire.controller(TestController);
		
		TestController.prototype.getIndex = function($test1, $test2) {
			$test1.should.equal('Dinosaur');
			$test2.should.equal('Koala');

			return {
				test1: $test1,
				test2: $test2
			};
		}
		app.controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		request(app.server)
			.get('/Dinosaur/Koala')
			.expect(200, function(error, response) {
				response.text.should.equal('{"test1":"Dinosaur","test2":"Koala"}');
				done();
			});
	});
})
