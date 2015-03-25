var fire = require('fire');

var app1 = fire.app('nodeonfire.org', 'app1', {isMaster: true});
var app2 = fire.app('nodeonfire.org', 'app2', {});

app1.controller('/', function TestController() {
	//
});

app2.controller('/', function TestController() {
	//
});

fire.start();
