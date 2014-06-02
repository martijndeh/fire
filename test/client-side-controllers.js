var fire = require('..');
var util = require('util');

describe('client side controllers', function() {
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

		TestController.toString().should.equal('function TestController(arg1, arg2) {\n' +
			'			called = true;\n' +
		'		}');

		done();
	});


});