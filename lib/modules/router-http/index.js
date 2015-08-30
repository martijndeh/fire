exports = module.exports = RouterHTTP;

var debug = require('debug')('fire:router-http'); //jshint ignore:line

/**
 * The HTTP router.
 *
 * Currently, this module does not do anything.
 *
 * In the future, {@link HTTPServer} will be merged into this module.
 *
 * @constructor
 */
function RouterHTTP(router, HTTPServer) { //jshint ignore:line
    router.addTransport(this);

    this.stages = ['build', 'release', 'run'];

    this.addRoute = function(method, path, preparedConstructor) { //jshint ignore:line
        //
    };

    this.addUse = function(path, preparedConstructor, constructor) { //jshint ignore:line
        //
    };
}
