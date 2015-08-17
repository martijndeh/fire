var dotenv = require('dotenv-save');
dotenv.load({silent: true});

var Firestarter = require('./lib/firestarter');
var firestarter = new Firestarter();

/**
 * This is the initial method exported by Node on Fire used to either create or retrieve an app.
 *
 * ```
 * var app = require('fire')('nodeonfire.org', {});
 * ```
 *
 * Previously, an app was created by calling the `app` method on the fire object directly. This has been deprecated.
 */
function getApp(id, name, settings) {
    var app = firestarter.app(id, name, settings);
    firestarter.start();
    return app;
}

/**
 * Luckily functions are objects as well in JavaScript.
 *
 * For backwards compatibility reasons we're defining the methods also defined in `fire`.
 */
getApp.app = function(appId, appName, appSettings) {
    /*
    console.log([
        '`Fire#app` has been deprecated. `require(\'fire\')` now returns the `Fire#app` method directly. This is how you can create and initialize your app:',
        '',
        'var app = require(\'fire\')(\'nodeonfire.org\', {});',
        '',
        'This avoids declaring a `fire` variable in your outer scope, especially annoying when using the `fire` service in dependency injection which would always give you a linting error. Not anymore.',
        '',
        '`Fire#start` has also been deprecated. Instead, it\'s invoked after you\'ve initialized your app automatically. So you can remove another line of code. :-)'
    ].join('\n'));
    */
    
    return firestarter.app(appId, appName, appSettings);
};

getApp.isClient = function() { return false; };
getApp.isServer = function() { return true; };

getApp.start = function() {
    return firestarter.start();
};

getApp.stop = function() {
    return firestarter.stop();
};

getApp._getFirestarter = function() {
    return firestarter;
};

exports = module.exports = getApp;
