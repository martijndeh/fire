/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var util = require('util');
var streams = require('memory-streams');
//var request = require('supertest');
var assert = require('assert');

describe('monarch', function() {
	var app = null;
	var monarch = null;

	beforeEach(function(done) {
		app = fire.app('example', {disabled: true});
		monarch = app.monarch;
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

		monarch.addController(TestController);

		var writeStream = new streams.WritableStream();

		monarch.generate(writeStream)
			.then(function() {
				assert.equal(writeStream.toString().length, 3063);

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


		monarch.addModel(User);
		monarch.addModel(Pet);

     	monarch.addController(TestController);
     	monarch.addController(fn7);
     	monarch.addController(fn6);
     	monarch.addController(fn5);
     	monarch.addController(fn4);
     	monarch.addController(fn3);
     	monarch.addController(fn2);
     	monarch.addController(fn1);
     	monarch.addController(fn0);

     	var writeStream = new streams.WritableStream();

		monarch.generate(writeStream)
			.then(function() {
				console.log(writeStream.toString());
				assert.equal(writeStream.toString().length, 4984);

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

		monarch.generate(writeStream)
			.then(function() {
				assert.equal(writeStream.toString().length, 2182);

				done();
			})
			.done();
	});
});
