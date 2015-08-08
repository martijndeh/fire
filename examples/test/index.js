/* global mixpanel */
'use strict';

/**
 * We start by creating our app.
 *
 * We pass the MIXPANEL_API_KEY environment variable to the app's settings so we can use it in our templates (see view.jade).
 */
var app = require('fire')('nodeonfire.org', {
	modules: ['angular-route'],
	MIXPANEL_API_KEY: process.env.MIXPANEL_API_KEY,
	NODE_ENV: process.env.NODE_ENV
});

/**
 * We declare our first A/B test: TextOfButtonTest.
 *
 * Based on the variants of this test, A or B, we set the text of our button.
 */
app.test(function TextOfButtonTest() {
	return {
		variants: ['A', 'B']
	};
});

app.service(function AnalyticsService() {
	var isMixpanelInitialized = (typeof mixpanel != 'undefined');

	this.track = function(eventName, eventProperties) {
		if(isMixpanelInitialized) {
			mixpanel.track(eventName, eventProperties);
		}
	};

	this.register = function(propertyName, propertyValue) {
		if(isMixpanelInitialized) {
			mixpanel.register(propertyName, propertyValue);
		}
	};
});

/**
 * In our controller we fire some analytics events (in this case Mixpanel, but, obviously, any analytics provider is possible).
 *
 * Please note: textOfButtonTest is starts with a lower case letter. This is a dependency we're creating in StartController#resolve which gives us the variant immediately accessible (not a promise, but a string).
 */
function StartController(textOfButtonTest, $scope, AnalyticsService, $log) {
	$log.debug('In start controller!');

	/**
	 * Send the initial event to our analytics provider.
	 */
	AnalyticsService.track('Start Viewed');

	/**
	 * Create a method which gets invoked when the user hits the button.
	 */
	$scope.register = function() {
		AnalyticsService.track('Register Clicked');
	};

	/**
	 * Set the text of the button based on the variant of the test.
	 */
	var text = {
		A: 'Register now',
		B: 'Register for FREE'
	};
	$scope.buttonText = text[textOfButtonTest];
}
app.controller('/', StartController);

/**
 * This participates the user in our test, sets the variant as super property and returns the variant. The controller only gets loaded once the promises in resolves get resolved.
 */
StartController.prototype.resolve = function() {
	return {
		textOfButtonTest: function(TextOfButtonTest, AnalyticsService) {
			return TextOfButtonTest.participate()
				.then(function(variant) {
					AnalyticsService.register('textOfButtonTest', variant);
					return variant;
				});
		}
	};
};
