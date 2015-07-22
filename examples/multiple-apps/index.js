var fire = require('fire');

/**
 * We create the `app1` app and set it as the master app.
 *
 * The master app keeps tracks of all migrations of your shared models.
 */
var app1 = fire.app('nodeonfire.org', 'app1', {isMaster: true});

/**
 * We create another app: `app2`.
 *
 * By setting NODE_APP=app2, building and running the project we can start `app2`.
 *
 * Tip! You can use the below command to quickly set the NODE_APP environment variable:
 *
 * 	`fire config:set NODE_APP=app2`
 */
var app2 = fire.app('nodeonfire.org', 'app2', {});

app1.controller('/', function TestController() {
	//
});

app2.controller('/', function TestController() {
	//
});

fire.start();
