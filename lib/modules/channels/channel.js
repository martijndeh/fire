'use strict';

exports = module.exports = Channel;

var Q = require('q');
var debug = require('debug')('fire:channel');

function Channel(type, id, moduleProperties) {
	this.type = type;
	this.id = id;
	this.webSockets = [];

	moduleProperties.set(this);
}

Channel.prototype.startConsuming = function() {
	debug('Channel#startConsuming');

	var self = this;
	return this.channels.messageQueue.startConsumingMessages(this.type + '.' + this.id, function(messageMap) {
			debug('Received a message.');

			self._sendMessage(messageMap);
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

Channel.prototype.findAuthenticator = function(webSocket) {
	var authenticatorModel = this.models.getAuthenticator();

	if(!authenticatorModel) {
		return Q.when(null);
	}

	return authenticatorModel.findOne({accessToken:webSocket.session.at});
};

Channel.prototype.canSubscribe = function() {
	return true;
};

Channel.prototype._parseSubscribeMessage = function(messageMap, webSocket) {
	var self = this;
	return this.findAuthenticator(webSocket)
		.then(function(authenticator) {
			return self.canSubscribe(authenticator);
		})
		.then(function(result) {
			if(result) {
				debug('Subscribe user');

				self.addWebSocket(webSocket);

				return Q.when(self.parseSubscribeMessage(messageMap, webSocket));
			}
			else {
				debug('Not subscribing user');
			}
		});
};

Channel.prototype.parseSubscribeMessage = function(messageMap, webSocket) { //jshint ignore:line
	// Supposed to be overwritten by Channel implementation.
};

Channel.prototype.parseMessage = function(messageMap, webSocket) {
	if(messageMap.event == '_subscribe') {
		return this._parseSubscribeMessage(messageMap, webSocket);
	}
	else if(messageMap.event == '_authorize') {
		// TODO: Implement authorize via access token?!
	}
	else {
		return Q.when(this.getMessage(messageMap, webSocket));
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

	debug('Channel#_sendMessage ' + packetString + ' (' + this.webSockets.length + ')');

	this.webSockets.forEach(function(webSocket) {
		webSocket.send(packetString);
	});
};

Channel.prototype.sendMessage = function(messageMap) {
	// TODO: Optimize this. Send the message to the sockets directly and exclude it from the PubSub system.

	debug('Channel#sendMessage');

	return this.channels.messageQueue.publishMessage(this.type + '.' + this.id, messageMap);
};
