/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var util = require('util');
var streams = require('memory-streams');
//var request = require('supertest');
var assert = require('assert');

describe('bridge', function() {
	var app = null;
	var bridge = null;

	beforeEach(function(done) {
		app = fire.app('example', {disabled: true});
		bridge = app.bridge;
		app.run()
			.then(function() {
				done();
			})
			.done();
	});

	afterEach(function(done) {
		app.stop()
			.then(function() {
				done();
			})
			.done();
	});

	it('can replace constructor', function(done) {
		var called = false;

		var TemporaryController = function() {};

		function TestController(arg1, arg2) { //jshint ignore:line
			called = true;
		}

		TestController.prototype.test = function() {
			return 123;
		};
		util.inherits(TemporaryController, TestController);

		var controller = new TemporaryController();
		controller.should.be.instanceof(TestController);
		controller.test().should.equal(123);
		assert.equal(called, false);

		TestController.name.should.equal('TestController');

		TestController.toString().should.equal(
		'function TestController(arg1, arg2) { //jshint ignore:line\n' +
		'			called = true;\n' +
		'		}');

		done();
	});

	it('can generate controller methods', function(done) {
		function TestController() {}

		TestController.prototype.doTest = function(foo, bar, baz) { //jshint ignore:line
			return 123;
		};

		TestController.prototype._doTest2 = function() {
			return 333;
		};

		TestController.prototype.doTest3 = function(a) {
			return a;
		};

		TestController.prototype.getTest4 = function($id) {
			return $id;
		};

		bridge.addController(TestController);

		var writeStream = new streams.WritableStream();

		bridge.generate(writeStream)
			.then(function() {
				assert.equal(writeStream.toString().length, 3289);

				done();
			})
			.done();
	});

	it('can generate model methods', function(done) {
		function User() {
			this.name = [this.String];
		}

		function Pet() {
			this.name = [this.String];
		}

		function TestController ( $scope, fire/*), test*/ ){/* jshint ignore:start */$scope.user = null; //jshint ignore:line
			// Test comment.

			$scope.submit = function() {
				fire.TestController.test()
					.then(function(result) {

					});
			};

			/* jshint ignore:end */
		}

		// This is just an API call.
		TestController.prototype.getTest = function() {
			return 123;
		};

		// .. to ..
		function fn3
			// Test
			(param1, //jshint ignore:line
			// Test
			param2) { //jshint ignore:line
			/* jshint ignore:start */
			alert('"There."');
			/* jshint ignore:end */
		}

		// Luckily this isn't possible: function Split/*test*/Controller() { alert('test'); }

		function/*post-keyword*/fn0/*post-name*/(param1, param2)/*post-parens*/{ //jshint ignore:line
        	/*inside*/
        	/* jshint ignore:start */
        	execute(param2, param1);
        	/* jshint ignore:end */
    	}

    	function fn1() {
    		/* jshint ignore:start */
        	alert("/*This is not a comment, it's a string literal*/");
        	/* jshint ignore:end */
     	}

    	function fn2() {
    		/* jshint ignore:start */
    		test();
    		/* jshint ignore:end */
     	}

     	function fn4(/*{start bracket in comment}*/) { //jshint ignore:line
     		// Comments remains untouched.
     	}

     	function fn5(/*start bracket, and closing in comment)()*/) {}

		function fn6(/*{*/) {}
		function fn7(
					//{
						) {
			// Test :)
			//{
		}


		bridge.addModel(User);
		bridge.addModel(Pet);

     	bridge.addController(TestController);
     	bridge.addController(fn7);
     	bridge.addController(fn6);
     	bridge.addController(fn5);
     	bridge.addController(fn4);
     	bridge.addController(fn3);
     	bridge.addController(fn2);
     	bridge.addController(fn1);
     	bridge.addController(fn0);

     	var writeStream = new streams.WritableStream();

		bridge.generate(writeStream)
			.then(function() {
				assert.equal(writeStream.toString().length, 6676);

				done();
			})
			.done();
	});

	it('can export angular-methods', function(done) {
		app.directive('myCustomer', function() {
    		return {
      			template: 'Name: {{customer.name}} Address: {{customer.address}}'
    		};
  		});

		app.config(['$scope', 'fire', function($scope, fire) { //jshint ignore:line

		}]);

		app.service(function TestService($scope) { //jshint ignore:line
			// This is the service.
			return this;
		});

		var writeStream = new streams.WritableStream();

		bridge.generate(writeStream)
			.then(function() {
				assert.equal(writeStream.toString().length, 2124);

				done();
			})
			.done();
	});
});
