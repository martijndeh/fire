/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var util = require('util');
var streams = require('memory-streams');
var request = require('supertest');
var assert = require('assert');

var Monarch = require('./../lib/modules/monarch');

describe('monarch', function() {
	var app = null;
	var monarch = null;

	beforeEach(function(done) {
		app = fire.app('example', {});
		monarch = new Monarch(app);

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
		//

		done();
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
				assert.equal(writeStream.toString().length, 3140);

				done();
			})
			.done();
	});

	it('can respond to view route', function(done) {
		function ViewController() {}
		fire.controller(ViewController);

		ViewController.prototype.view = function() {
			return 'This is a test. :-)';
		};

		setImmediate(function() {
			var agent = request.agent(app.express);
			agent.get('/').send().expect(200, function(error, response) {
				assert.equal(response.text.length, 193);

				done(error);
			});
		});
	});
});
