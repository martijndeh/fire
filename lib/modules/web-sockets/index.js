exports = module.exports = WebSockets;

var debug = require('debug')('fire:web-sockets');
var Context = require('./context');
var WebSocketServer = require('ws').Server;

/**
 * Creates a web socket service and exposes the incoming connections.
 *
 * This module exports a `webSocket` module, see {@link App#webSocket}. The method take one argument and is invoked whenever a new web socket connection is created. The callback is invoked with one argument: the web socket context.
 *
 * The web socket context is a wrapper around the native web socket connection, see {@link Context}.
 */
function WebSockets(HTTPServer) {
    var delegates = [];
    var server = null;

    this.stages = ['run'];

    /**
     * We only start if we're in the web process and the express server exists.
     */
    this.start = function(argv, models) {
        if(process.env.NODE_ENV != 'test' && !argv.web && Object.keys(argv).length > 1 || !HTTPServer.express) {
    		debug('Not starting web socket server');
    		return false;
    	}

    	debug('Creating web socket server');

    	server = new WebSocketServer({server: HTTPServer.server});

    	var authenticatorModel = models.getAuthenticator();
    	server.on('connection', function(webSocket) {
            var context = new Context(webSocket, authenticatorModel);

            delegates.forEach(function(delegate) {
                delegate(context);
            });
    	});
    };

    /**
     * Adds a delegate to be invoked when a new web socket context is created.
     */
    this.onContext = function(delegate) {
        delegates.push(delegate);
    };

    /**
     * Exports {@link App#webSocket}.
     */
    this.exports = function() {
        return {
            webSocket: function(delegate) {
                delegates.push(delegate);
            }
        };
    };
}
