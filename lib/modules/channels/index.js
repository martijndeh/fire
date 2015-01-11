'use strict';

exports = module.exports = Channels;

var util = require('util');
var Channel = require('./channel');
var utils = require('./../../helpers/utils');
var path = require('path');
var debug = require('debug')('fire:channels');

var MessageQueue = require('./../message-queue');

/**
 * The Channels module.
 *
 * Provides an implementation for real time communication between the clients and the servers.
 *
 * @param {App} app
 * @constructor
 */
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
Channels.prototype.enableModuleProperty = true;

/**
 * A generator for the {@link Bridge} module.
 *
 * This generator generates the client-side channel services used to communication from the client to the server.
 *
 * @return {Generator} A generator instance used by the Bridge module to write the file.
 */
Channels.prototype.generator = function() {
	return new this.app.bridge.Generator(path.join(__dirname, 'templates', this.app.type, 'channel-services.js'), {channels: Object.keys(this._constructors).map(function(name) {
		return {name: name};
	})});
};

/**
 * @access private
 *
 * Adds a channel constructor method. A channel is not actually allocated. Once a channel is retrieved via {@link Channels#getChannel} an instance is created.
 *
 * @param {Constructor} channelConstructor
 */
Channels.prototype.addChannelConstructor = function(channelConstructor) {
	util.inherits(channelConstructor, Channel);

	this._constructors[channelConstructor.name] = channelConstructor;
};

/**
 * Sets up the channels.
 *
 * - Loads all the channels from `channels/` folder.
 * - Creates getters for the channels e.g. for TestChannel:
 * ```js
 * var channel = channels.TestChannel.get('test');
 * ```
 * - Connects to the message queue
 *
 * @param  {String} basePath The app's project directory.
 */
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

/**
 * Disconnects the message queue.
 */
Channels.prototype.stop = function() {
	return this.messageQueue && this.messageQueue.disconnect();
};

/**
 * Creates and returns a specific channel instance.
 *
 * If a channel is created, and this is a web process, starts consuming messages for the channel.
 *
 * @param {String} channelType The type of the channel. This is the name of the channel's constructor method.
 * @param {String} channelId   The id of the channel. This is coming from user land.
 */
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
		Channel.call(channel, channelType, channelId, this.app.moduleProperties);

		channelsMap[channelId] = channel;

		// If we have a web server running, we are sure to be in the web process.
		// We only want to consume messages in the web processes (as only there are web sockets).
		if(this.app.HTTPServer.server) {
			debug('Start consuming on channel.');

			channel.startConsuming();
		}
		else {
			debug('Not consuming on channel.');

			channel.disableConsuming();
		}
	}

	return channel;
};

/**
 * Parses a (web socket) packet.
 *
 * @param {Dictionary} packet
 * @param {Dictionary} packet.channel
 * @param {String} packet.channel.id The id of the channel.
 * @param {String} packet.channel.type The type of the channel.
 * @param {Dictionary} packet.message The message is passed directly to any consumer.
 * @param {WebSocket} webSocket
 */
Channels.prototype.parsePacket = function(packet, webSocket) {
	var channel = this.getChannel(packet.channel.type, packet.channel.id);

	if(channel) {
		return channel.parseMessage(packet.message, webSocket);
	}
};
