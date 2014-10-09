'use strict';

exports = module.exports = Channel;

function Channel(type, id, channels) {
	this.type = type;
	this.id = id;
	this.webSockets = [];
	this.channels = channels;
	this._queue = [];

	// TODO: workers, channels, models, should be available...
}

Channel.prototype.disableConsuming = function() {
	var queue = this._queue;
	this._queue = null;

	var self = this;
	queue.forEach(function(messageMap) {
		self.sendMessage(messageMap);
	});
};

Channel.prototype.startConsuming = function() {
	var self = this;
	this.channels.messageQueue.startConsumingMessages(this.type + '.' + this.id, function(messageMap) {
			self._sendMessage(messageMap);
		})
		.then(function() {
			self.disableConsuming();
		});
};

Channel.prototype.removeWebSocket = function(webSocket) {
	var index = this.webSockets.indexOf(webSocket);
	if(index >= 0) {
		this.webSockets.splice(index, 1);
	}

	this.parseUnsubscribeMessage(webSocket);
};

Channel.prototype.addWebSocket = function(webSocket) {
	this.webSockets.push(webSocket);
	webSocket.channels.push(this);
};

Channel.prototype.parseUnsubscribeMessage = function(webSocket) { //jshint ignore:line
	//
};

Channel.prototype._parseSubscribeMessage = function(messageMap, webSocket) {
	// TODO: Check if we can subscribe / if we are authorized

	this.addWebSocket(webSocket);

	this.parseSubscribeMessage(messageMap, webSocket);
};

Channel.prototype.parseSubscribeMessage = function(messageMap, webSocket) { //jshint ignore:line
	// Supposed to be overwritten by Channel implementation.
};

Channel.prototype.parseMessage = function(messageMap, webSocket) {
	if(messageMap.event == '_subscribe') {
		this._parseSubscribeMessage(messageMap, webSocket);
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
		this.channels.messageQueue.publishMessage(this.type + '.' + this.id, messageMap);
	}
};
