'use strict';

exports = module.exports = Channels;

var util = require('util');
var Channel = require('./channel');
var utils = require('./../../helpers/utils');
var path = require('path');
var debug = require('debug')('fire:channels');

var MessageQueue = require('./../workers/message-queue');

function Channels(app) {
	this.app = app;
	this._constructors = {};
	this._channels = {};
	this.messageQueue = MessageQueue.factory();

	var self = this;
	app.channel = function(channelConstructor) {
		self.addChannelConstructor(channelConstructor);
		return app;
	};
}
Channels.prototype.ignoreDisabled = true;

Channels.prototype.addChannelConstructor = function(channelConstructor) {
	util.inherits(channelConstructor, Channel);

	this._constructors[channelConstructor.name] = channelConstructor;
};

Channels.prototype.setup = function(basePath) {
	if(basePath) {
		debug(path.join(basePath, 'channels'));

		utils.requireDirSync(path.join(basePath, 'channels'));
	}

	var self = this;
	Object.keys(this._constructors).forEach(function(channelType) {
		self[channelType] = {
			get: function(channelId) {
				return self.getChannel(channelType, channelId);
			}
		};
	});

	if(Object.keys(this._constructors).length > 0) {
		if(!this.messageQueue) {
			throw new Error('Warning: no message queue set but channels found.');
		}

		return this.messageQueue.connect();
	}
};

Channels.prototype.stop = function() {
	return this.messageQueue && this.messageQueue.disconnect();
};

Channels.prototype.getChannel = function(channelType, channelId) {
	var channelsMap = this._channels[channelType];
	if(!channelsMap) {
		channelsMap = {};
		this._channels[channelType] = channelsMap;
	}

	var channel = channelsMap[channelId];
	if(!channel) {
		var channelConstructor = this._constructors[channelType];

		channel = new channelConstructor(channelType, channelId);
		Channel.call(channel, channelType, channelId, this);

		channelsMap[channelId] = channel;
	}

	return channel;
};

Channels.prototype.parsePacket = function(packet, webSocket) {
	var channel = this.getChannel(packet.channel.type, packet.channel.id);

	if(channel) {
		channel.parseMessage(packet.message, webSocket);
	}
};
