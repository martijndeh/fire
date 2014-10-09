'use strict';

exports = module.exports = Channel;

function Channel(type, id, channels) {
	this.type = type;
	this.id = id;
	this.webSockets = [];
	this.channels = channels;
	this._queue = [];

	// TODO: workers, channels, models, should be available...
	// TODO: Consume messages from the PubSub queue in case there are more web processes

	var self = this;
	this.channels.messageQueue.__startConsuming(type + '.' + id, function(messageMap) {
			self._sendMessage(messageMap);
		})
		.then(function() {
			var queue = self._queue;
			self._queue = null;

			queue.forEach(function(messageMap) {
				self.sendMessage(messageMap);
			});
		});
}

Channel.prototype.parseSubscribeMessage = function(messageMap, webSocket) {
	// TODO: Check if we can subscribe / if we are authorized
	this.webSockets.push(webSocket);
};

Channel.prototype.parseMessage = function(messageMap, webSocket) {
	if(messageMap.event == '_subscribe') {
		this.parseSubscribeMessage(messageMap, webSocket);
	}
	else if(messageMap.event == '_authorize') {
		// TODO: Implement authorize via access token?!
	}
	else {
		this.getMessage(messageMap, webSocket);

		// TODO: Publish this message over the PubSub queue
	}
};

Channel.prototype.getMessage = function(messageMap, webSocket) { //jshint ignore:line
	// This should be overwritten by Channel implementations.
};

Channel.prototype._sendMessage = function(messageMap) {
	// TODO: Stringify should NOT happen in this module.
	var packetString = JSON.stringify({
		channel: {
			type: this.type,
			id: this.id
		},
		message: messageMap
	});

	this.webSockets.forEach(function(webSocket) {
		webSocket.send(packetString);
	});
};

Channel.prototype.sendMessage = function(messageMap) {
	// TODO: Optimize this. Send the message to the sockets directly and exclude it from the PubSub system.

	if(this._queue) {
		this._queue.push(messageMap);
	}
	else {
		this.channels.messageQueue.__publishMessage(this.type + '.' + this.id, messageMap);
	}
};
