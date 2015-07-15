/* global mixpanel */
'use strict';

var fire = require('fire');

var app = fire.app('nodeonfire.org', {
	modules: ['angular-route'],
	MIXPANEL_API_KEY: process.env.MIXPANEL_API_KEY
});

app.config(function(TestsServiceProvider) {
	TestsServiceProvider.delegate(function(test, variant) {
		console.log('Join test ' + test + ' with variant ' + variant);

		var properties = {};
		properties[test] = variant;
		mixpanel.register(properties);
	});
});

app.test(function TextOfButtonTest() {
	return {
		controller: 'StartController',
		variants: ['A', 'B']
	};
});

app.controller('/', function StartController(TextOfButtonTest, $scope) {
	if(TextOfButtonTest.getVariant() == 'A') {
		$scope.buttonText = 'Register for FREE';
	}
	else {
		$scope.buttonText = 'Register now';
	}

	$scope.register = function() {
		mixpanel.track('Register');
	};
});

fire.start();
