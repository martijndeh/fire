var fire = require('fire');

var app = fire.app('todomvc', { //jshint ignore:line
	modules: ['angular-route'],
	NODE_ENV: process.env.NODE_ENV
});

fire.start();
