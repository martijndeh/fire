var fire = require('..');
var util = require('util');
var tmp = require('tmp');

var Monarch = require('./../lib/modules/monarch');

describe('monarch', function() {
	function Controller(fire, $scope) {

	}

	it('can replace constructor', function(done) {
		var called = false;

		var TemporaryController = function() {}

		function TestController(arg1, arg2) {
			called = true;
		}

		TestController.prototype.test = function() {
			return 123;
		};
		util.inherits(TemporaryController, TestController);

		var controller = new TemporaryController();
		controller.should.be.instanceof(TestController);
		controller.test().should.equal(123);
		called.should.be.false;

		TestController.name.should.equal('TestController');

		TestController.toString().should.equal(
		'function TestController(arg1, arg2) {\n' +
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

		function TestController ( $scope, fire/*), test*/ ){$scope.user = null;
			// Test comment.

			$scope.submit = function() {
				fire.TestController.test()
					.then(function(result) {

					});
			};
		}

		// This is just an API call.
		TestController.prototype.getTest = function() {
			return 123;
		};

		// .. to ..
		var monarch = new Monarch();

		function fn3
			// Test
			(param1,
			// Test
			param2) {
			alert('"There."');
		}

		// Luckily this isn't possible: function Split/*test*/Controller() { alert('test'); }

		function/*post-keyword*/fn0/*post-name*/(param1, param2)/*post-parens*/{
        	/*inside*/
        	execute(param2, param1);
    	}

    	function fn1() {
        	alert("/*This is not a comment, it's a string literal*/");
     	}

    	function fn2() {
    		test();
     	};

     	function fn4(/*{start bracket in comment}*/) {
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

		var monarch = new Monarch();
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

		//monarch.generate(writeStream);

		//console.log(writeStream.toString());

		//console.log(monarch.generate());

		done();
	})
});
