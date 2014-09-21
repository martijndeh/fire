/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var util = require('util');
var streams = require('memory-streams');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

// fs.writeFileSync(path.join(__dirname, 'fixtures/bridge/controller-methods.js'), writeStream.toString());

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
		assert.equal(controller instanceof TestController, true);
		assert.equal(controller.test(), 123);
		assert.equal(called, false);

		assert.equal(TestController.name, 'TestController');

		assert.equal(TestController.toString(),
		'function TestController(arg1, arg2) { //jshint ignore:line\n' +
		'			called = true;\n' +
		'		}');

		done();
	});

	it('can generate controller methods', function(done) {
		function TestController() {}
		app.controller(TestController);

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

		var writeStream = new streams.WritableStream();

		app.models.setup()
			.then(function() {
				return app.controllers.setup();
			})
			.then(function() {
				return bridge.generate(writeStream);
			})
			.then(function() {
				assert.equal(writeStream.toString().length > 0, true);
				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures/bridge/controller-methods.js')).toString());

				done();
			})
			.done();
	});

	it('can generate model methods', function(done) {
		function Pet() {
			this.name = [this.String];
		}

		function User() {
			this.name 			= [this.String, this.Unique];
			this.votes 			= [this.HasMany(this.models.Article, 'voters')];
			this.accessControl 	= [this.CanRead(function() { return false; }), this.CanUpdate(function() { return false; })];
		}

		function Article() {
			this.title 			= [this.String, this.Required];
			this.voters 		= [this.HasMany(this.models.User, 'votes'), this.AutoFetch, this.CanCreate(function(articleID) {
				return this.models.ArticlesUsers.findOne({user: this.body.user, article: articleID})
					.then(function(articleUser) {
						return (!articleUser);
					});
			})];
			this.accessControl 	= [this.CanRead(function() { return true; }), this.CanUpdate(function() { return true; }), this.CanDelete(function() { return false; })];
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
		app.controller(TestController);

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

		app.model(Pet);

		app.model(User);
		app.model(Article);

     	app.controller(fn7);
     	app.controller(fn6);
     	app.controller(fn5);
     	app.controller(fn4);
     	app.controller(fn3);
     	app.controller(fn2);
     	app.controller(fn1);
     	app.controller(fn0);

     	var writeStream = new streams.WritableStream();

		app.models.setup()
			.then(function() {
				return app.controllers.setup();
			})
			.then(function() {
				return bridge.generate(writeStream);
			})
			.then(function() {
				assert.equal(writeStream.toString().length > 0, true);
				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures/bridge/model-methods.js')).toString());

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

		app.models.setup()
			.then(function() {
				return app.controllers.setup();
			})
			.then(function() {
				return bridge.generate(writeStream);
			})
			.then(function() {
				assert.equal(writeStream.toString().length > 0, true);
				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures/bridge/angular-methods.js')).toString());

				done();
			})
			.done();
	});

	it('can export inline template', function(done) {
		app.template('test', '<h1>Test template.</h1>');

		function TestController() {

		}
		app.controller(TestController);

		TestController.prototype.view = function() {
			return this.template('test');
		};

		var writeStream = new streams.WritableStream();

		app.models.setup()
			.then(function() {
				return app.controllers.setup();
			})
			.then(function() {
				return bridge.generate(writeStream);
			})
			.then(function() {
				assert.equal(writeStream.toString().length > 0, true);
				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures/bridge/inline-templates.js')).toString());

				done();
			})
			.done();
	});
});
