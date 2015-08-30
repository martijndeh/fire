/* global describe, before, beforeEach, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var WebSocket = require('ws');

describe('router web sockets', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		if(!process.env.WEB_SOCKET_PORT) {
			console.log('No web socket port?!');
			throw new Error('Please define WEB_SOCKET_PORT when running tests.');
		}

		helper.setup = function(app) {
			app.get('/', function() {
				return 123;
			});

			app.get('/test/:value', function(request) {
				return {
					value: request.params.value
				};
			});
		};

		helper.createModels = null;
	});

	it('can get simple value', function(done) {
		var webSocket = new WebSocket('ws://127.0.0.1:' + process.env.WEB_SOCKET_PORT);
		webSocket.on('error', function(error) {
			done(error);
		});

		webSocket.on('open', function() {
			webSocket.on('message', function(data) {
				var message = JSON.parse(data);

				assert.equal(message._id, 1);
				assert.equal(message.result, 123);

				done();
			});

			webSocket.send(JSON.stringify({
				_method: 'GET',
				_path: '/',
				_id: 1
			}));
		});
	});

	it('can get param value', function(done) {
		var webSocket = new WebSocket('ws://127.0.0.1:' + process.env.WEB_SOCKET_PORT);
		webSocket.on('error', function(error) {
			done(error);
		});

		var id = Math.floor(Math.random() * 9999);

		webSocket.on('open', function() {
			webSocket.on('message', function(data) {
				console.log(data);

				var message = JSON.parse(data);

				assert.equal(message._id, id);
				assert.equal(message.result.value, 456);

				done();
			});

			webSocket.send(JSON.stringify({
				_path: '/test/456',
				_id: id
			}));
		});
	});

	it('can get 404', function(done) {
		var webSocket = new WebSocket('ws://127.0.0.1:' + process.env.WEB_SOCKET_PORT);
		webSocket.on('error', function(error) {
			done(error);
		});

		var id = Math.floor(Math.random() * 9999);

		webSocket.on('open', function() {
			webSocket.on('message', function(data) {
				var message = JSON.parse(data);

				assert.equal(message._id, id);
				assert.equal(typeof message.result, 'undefined');
				assert.notEqual(message.error, null);

				done();
			});

			webSocket.send(JSON.stringify({
				_path: '/404',
				_id: id
			}));
		});
	});
});
