var app = require('fire')('todomvc', {
	modules: ['angular-route'],
	NODE_ENV: process.env.NODE_ENV
});

app.build(function log() {
	console.log('A build method. This gets added as `fire build:log` task. Automatically invoked during the build stage.');
});

app.release(function test() {
	console.log('A release method. This gets added as `fire release:test`. Automatically invoked during the release stage.');
});
