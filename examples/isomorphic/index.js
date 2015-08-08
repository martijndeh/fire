'use strict';

/**
 * Create our app—with the angular-route module.
 */
var app = require('fire')('nodeonfire.org', {
	modules: ['angular-route'],
	NODE_ENV: process.env.NODE_ENV
});

/**
 * This is an isomorphic service. It can either be run on the client- or the server-side. Simply inject it using the dependency injection.
 *
 * Using the fire service we check which side we're running on.
 */
app.service(function MyService(fire) {
	this.log = function(location) {
		if(fire.isServer()) {
			console.log(location + ' on the server.');
		}
		else if(fire.isClient()) {
			console.log(location + ' on the client.');
		}
	};
});

/**
 * This is run on the back-end and the front-end side.
 */
app.run(function(MyService) {
	MyService.log('Run');
});

/**
 * This is a client-side controller, which injects the isomorphic MyService.
 */
app.controller('/', function StartController(MyService) {
	MyService.log('Controller');
});
