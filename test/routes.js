var fire = require('..');

var path = require('path');

var Controllers = process.env.NODE_COV ? require('../lib-cov/controllers') : require('../lib/controllers');
var Config = process.env.NODE_COV ? require('../lib-cov/config') : require('../lib/config');

var should = require('chai').should()

//todo: do something about a duplicate route!!!

describe('routes', function() {
	var controllers;

	afterEach(function() {
		controllers = null;
	})

	beforeEach(function() {
		Config.basePath = path.dirname(__dirname);
		controllers = new Controllers();
	})

	it('should create index route', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function() {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/$/i');
		route.verb.should.equal('get');

		done();
	})

	it('should create route in sub-directory', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function() {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/sub/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/sub(?:/)?$/i');
		route.verb.should.equal('get');

		done();
	})

	it('should create route in sub-sub-directory', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function() {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/sub1/sub2/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/sub1/sub2(?:/)?$/i');
		route.verb.should.equal('get');

		done();
	})

	it('should create route for post verb', function(done) {
		function TestController() {}
		TestController.prototype.postIndex = function() {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/$/i');
		route.verb.should.equal('post');

		done();
	})

	it('should create route for with 1 param', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function($test) {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/([^/]+)(?:/)?$/i');
		route.verb.should.equal('get');
		route.match('get', '/test', {}).should.not.be.null;
		should.equal(route.match('post', '/test', {}), null);
		should.equal(route.match('post', '/test/test', {}), null);

		done();
	})

	it('should create route for with 2 params', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function($test1, $test2) {}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];

		route.path.toString().should.equal('/^/([^/]+)/([^/]+)(?:/)?$/i');
		route.verb.should.equal('get');
		route.match('get', '/val1/val2', {}).should.not.be.null;
		should.equal(route.match('post', '/test', {}), null);
		should.equal(route.match('post', '/test/test', {}), null);

		done();
	})

	it('should create route with 1 matching param', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function($test1) {
			$test1.should.equal('val1');
		}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];
		route = route.match('get', '/val1', {});

		route.method.apply(new TestController(), Array.prototype.slice.call(route.matches, 1));

		done();
	})

	it('should create route with 2 matching params', function(done) {
		function TestController() {}
		TestController.prototype.getIndex = function($test1, $test2) {
			$test1.should.equal('Dinosaur');
			$test2.should.equal('Koala');
		}
		controllers.loadClass(TestController, Config.basePath + '/controllers/test.js', null);

		var route = controllers.routes[0];
		route = route.match('get', '/Dinosaur/Koala', {});

		route.method.apply(new TestController(), Array.prototype.slice.call(route.matches, 1));

		done();
	})
})
