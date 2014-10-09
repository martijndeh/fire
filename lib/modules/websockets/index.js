'use strict';

exports = module.exports = WebSockets;

var WebSocketServer = require('ws').Server;
var debug = require('debug')('fire:websockets');

/**
 * The WebSocket module.
 *
 * Listens for web socket connections.
 * @constructor
 */
function WebSockets(app) {
	this.app = app;
}

/**
 * Starts the web socket server if this is the web process.
 *
 * @param  {Dictionary} argv The process starting arguments.
 */
WebSockets.prototype.start = function(argv) {
	if(process.env.NODE_ENV != 'test' && !argv.web && argv._.length !== 0 || !this.app.hTTPServer.express) {
		debug('Not starting web socket server');
		return false;
	}

	debug('Creating web socket server');

	this.server = new WebSocketServer({server: this.app.hTTPServer.server});

	var self = this;
	this.server.on('connection', function(webSocket) {
		// TODO: Separate this from the Channels module...

		webSocket.channels = [];

		webSocket.on('message', function(data) {
			var packet = JSON.parse(data);

			// TODO: Emit this as an event so other modules can listen to it.

			self.app.channels.parsePacket(packet, webSocket);
		});

		webSocket.on('close', function() {
			webSocket.channels.forEach(function(channel) {
				channel.removeWebSocket(webSocket);
			});
		});
	});
};
