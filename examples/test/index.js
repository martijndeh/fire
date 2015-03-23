'use strict';

var fire = require('fire');

var test1App = fire.app('test', 'app1', {
	isMaster: true
});

test1App.run(['TestsService', function(TestsService) {
	TestsService.delegate = {
		participate: function(test, variant) {
			console.log('Join test ' + test + ' with variant ' + variant);

			/*
			var properties = {};
			properties[test] = variant;
			mixpanel.register(properties);
			*/
		}
	};
}]);

test1App.test(function ColorTest() {
	return {
		controller: 'TestController',
		variants: ['A', 'B']
	};
});

test1App.controller('/test1', function TestController(ColorTest, $scope) {
	console.log('Test controller!');
	console.log('Variant is: ' + ColorTest.getVariant());

	$scope.variant = ColorTest.getVariant();
});

var test2App = fire.app('test', 'app2', {});
test2App.controller('/test2', function TestController() {
	//
});

test1App.model(function User1() {
	this.name = [this.String];
});

test2App.model(function User2() {
	this.name = [this.String];
});

test2App.worker(function SomeWorker() {

});

test2App.scheduler(function SomeScheduler() {

});

test2App.trigger(function SomeTrigger() {

});

fire.start();
