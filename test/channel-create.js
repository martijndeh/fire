/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

var Channels = require('./../lib/modules/channels');

describe('channels', function() {
	var called = 0;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	describe('without authentication', function() {
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

		it('can subscribe to channel', function() {
			var channel = helper.app.channels.TestChannel.get('test');
			assert.equal(channel.webSockets.length, 0);

			return helper.app.channels.parsePacket({
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
				})
				.then(function() {
					assert.equal(channel.webSockets.length, 1);
				});
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

	describe('with authentication', function() {
		before(function() {
			helper.setup = function() {
				function PrivateChannel() {

				}
				helper.app.channel(PrivateChannel);

				PrivateChannel.prototype.canSubscribe = function(user) {
					return (user && user.name == 'Martijn');
				};

				function User() {
					this.name = [this.String, this.Authenticate];
				}
				helper.app.model(User);
			};

			helper.createModels = function() {
				return helper.app.models.User.create([{
					name: 'Martijn',
					password: '123',
					accessToken: '1234567890'
				}, {
					name: 'Martijn 2',
					password: '456',
					accessToken: '0987654321'
				}]);
			};
		});

		it('can subscribe', function() {
			var channel = helper.app.channels.PrivateChannel.get('test');
			return channel._parseSubscribeMessage({}, {channels: [], session:{at: '1234567890'}})
				.then(function() {
					assert.equal(channel.webSockets.length, 1);
				});
		});

		it('can not subscribe with unknown user', function() {
			var channel = helper.app.channels.PrivateChannel.get('test2');

			assert.equal(channel.webSockets.length, 0);

			return channel._parseSubscribeMessage({}, {channels: [], session:{at: '404'}})
				.then(function() {
					assert.equal(channel.webSockets.length, 0);
				});
		});

		it('can not subscribe with known user', function() {
			var channel = helper.app.channels.PrivateChannel.get('test2');

			assert.equal(channel.webSockets.length, 0);

			return channel._parseSubscribeMessage({}, {channels: [], session:{at: '0987654321'}})
				.then(function() {
					assert.equal(channel.webSockets.length, 0);
				});
		});
	});
});
