'use strict';

exports = module.exports = WebSockets;

var WebSocketServer = require('ws').Server;
var debug = require('debug')('fire:websockets');

function WebSockets(app) {
	this.app = app;
}

WebSockets.prototype.start = function(argv) {
	if(process.env.NODE_ENV != 'test' && !argv.web && argv._.length !== 0) {
		debug('Not starting web socket server');
		return false;
	}

	if(this.app.hTTPServer.express) {
		debug('creating web socket server');

		this.server = new WebSocketServer({server: this.app.hTTPServer.server});
	}

	var self = this;
	this.server.on('connection', function(webSocket) {
		webSocket.on('message', function(data) {
			var packet = JSON.parse(data);

			// TODO: Emit this as an event so other modules can listen to it.

			self.app.channels.parsePacket(packet, webSocket);
		});

		webSocket.on('close', function() {
			// TODO: .. remove web socket from all registered channels
			console.log('webSocket#close');
		});
	});
};
