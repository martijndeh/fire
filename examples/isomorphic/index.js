'use strict';

/**
 * Require Node on Fire.
 */
var fire = require('fire');

/**
 * Create our app—with the ngRoute module.
 */
var app = fire.app('nodeonfire.org', {
	modules: ['ngRoute']
});

/**
 * This is an isomorphic service. It can either be run on the client- or the server-side. Using the fire service we can check which side we're running on.
 */
app.service(function MyService(fire) { //jshint ignore:line
	this.log = function() {
		if(fire.isServer()) {
			console.log('This is the server.');
		}
		else if(fire.isClient()) {
			console.log('This is the client.');
		}
	};
});

/**
 * This is run on the back-end side in the run stage.
 */
app.configure(function(MyService) {
	MyService.log();
});

/**
 * This is a client-side controller, which injects the isomorphic MyService.
 */
app.controller('/', function StartController(MyService) {
	MyService.log();
});

fire.start();
