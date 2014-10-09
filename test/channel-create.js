/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

var Channels = require('./../lib/modules/channels');

describe('channels', function() {
	var called = 0;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			function TestChannel() {

			}
			helper.app.channel(TestChannel);
		};
		helper.createModels = null;
	});

	it('can create channel', function() {
		assert.notEqual(helper.app.channels.TestChannel, null);
		assert.notEqual(helper.app.channels.TestChannel.get, null);

		var channel = helper.app.channels.TestChannel.get('test');
		assert.notEqual(channel, null);
		assert.equal(channel.type, 'TestChannel');
		assert.equal(channel.id, 'test');
	});

	/*
	it('can start without message queue', function() {

	});
	*/

	it('can subscribe to channel', function() {
		var channel = helper.app.channels.TestChannel.get('test');
		assert.equal(channel.webSockets.length, 0);

		helper.app.channels.parsePacket({
			channel: {
				type: 'TestChannel',
				id: 'test'
			},
			message: {
				event: '_subscribe'
			}
		}, {
			channels: [],
			send: function() {
				//
			}
		});

		assert.equal(channel.webSockets.length, 1);
	});

	it('can send message over channel', function(done) {
		var channel = helper.app.channels.TestChannel.get('test');
		assert.equal(channel.webSockets.length, 0);

		var messageReceived = null;
		helper.app.channels.parsePacket({
			channel: {
				type: 'TestChannel',
				id: 'test'
			},
			message: {
				event: '_subscribe'
			}
		}, {
			channels: [],
			send: function(message) {
				messageReceived = message;
			}
		});

		channel.sendMessage({
			event: 'test'
		});

		setTimeout(function() {
			assert.notEqual(null, messageReceived);

			var message = JSON.parse(messageReceived);
			assert.equal(message.channel.id, 'test');
			assert.equal(message.channel.type, 'TestChannel');
			assert.equal(message.message.event, 'test');

			done();
		}, 10);
	});
});
