var app1 = require('fire')('nodeonfire.org', 'app1', {isMaster: true, modules: ['angular-route']});
var app2 = require('fire')('nodeonfire.org', 'app2', {modules: ['angular-route']});

app1.controller('/', function TestController() {
	//
});

app2.controller('/', function TestController() {
	//
});
