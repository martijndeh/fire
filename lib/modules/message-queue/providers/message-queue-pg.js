'use strict';

exports = module.exports = MessageQueuePostgres;

var MessageQueue = require('./..');

var util = require('util');
var Q = require('q');
var debug = require('debug')('fire:message-queue');
var pg = require('pg');

/**
 * AMQP implemention of the message queue.
 *
 * @param {String} connectionString The connection string. This is the `AMQP_URL` environment variable.
 */
function MessageQueuePostgres(connectionString) {
	MessageQueue.call(this, connectionString);

	this.channels = [];
	this.connection = null;
}
util.inherits(MessageQueuePostgres, MessageQueue);

/**
 * Connects to the AMQP instance e.g. RabbitMQ and returns the connection instance. If a connection is already established, this method resolves to the already existing connection.
 *
 * @return {Promise}
 */
MessageQueuePostgres.prototype.connect = function() {
	if(this.connection) {
		return Q.when(this.connection);
	}
	else {
		var connection = new pg.Client(this.connectionString);

		var self = this;
		connection.on('error', function() {
			console.log('we received some sort of an error... Reconnect!');
		});

		var defer = Q.defer();
		connection.connect(function(error) {
			if(error) {
				defer.reject(error);
			}
			else {
				self.connection = connection;

				connection.on('notification', function(msg) {
					console.log('NOTIFICATION');
					console.log(msg);
				});

				defer.resolve(connection);
			}
		});
		return defer.promise;
	}
};

/**
 * Disconnects from the AMQP instance if a connection exists.
 *
 * @return {Promise}
 */
MessageQueuePostgres.prototype.disconnect = function() {
	//
};

/**
 * Creates a channel and publishes the implementation specific `taskMap` to queue named `queueName`.
 *
 * @param {String} queueName
 * @param {Dictionary} taskMap
 */
MessageQueuePostgres.prototype.createTask = function(queueName, taskMap) {
	console.log('Warning: createTask is not yet supported...');
};

/**
 * Starts consuming tasks on the given queue. Each message gets serialized to a dictionary.
 *
 * @param {String}   queueName The name of the queue.
 * @param {Function} callback  The callback invoked whenever a new message is received. The message is acknowledged only if the callback resolves the returned promise. The message is not acknowledged when the callback returns and rejects the returned promise.
 */
MessageQueuePostgres.prototype.startConsumingTasks = function(queueName, callback) {
	console.log('Warning: consuming tasks is not yet supported.');
};

/**
 * Publishes a message to a fanout exchange. This is used for Publish/Subscribe mechanisms to send messages to many consumers at once.
 *
 * @param {String} exchangeName The name of the exchange.
 * @param {Dictionary} messageMap   The message to sent to the consumers. This is JSONified and send directly.
 */
MessageQueuePostgres.prototype.publishMessage = function(exchangeName, messageMap) {
	debug('Publish message ' + exchangeName);

	return this.connect()
		.then(function(connection) {
			return connection.query('NOTIFY test, ?', [JSON.stringify(messageMap)]);
		});
};

/**
 * Starts consuming messages on a fanout exchange named `exchangeName`. This is used for Publish/Subscribe mechanisms, see {@link MessageQueuePostgres#publishMessage}.
 *
 * If you want a work queue type of system, see {@link MessageQueuePostgres#createTask} instead.
 *
 * @param {String}   exchangeName The name of the exchange.
 * @param {Function} callback     [description]
 * @return {Promise} Returns a cleanup function which you should execute when you're done consuming messages.
 */
MessageQueuePostgres.prototype.startConsumingMessages = function(exchangeName, callback) {
	return this.connect()
		.then(function(connection) {
			return connection.query('LISTEN test');
		});

	/*
	return this.connect()
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			var result = channel.assertExchange(exchangeName, 'fanout', {});

			result = result.then(function() {
				return channel.assertQueue('', {exclusive: true});
			});

			result = result.then(function(queue) {
				return channel.bindQueue(queue.queue, exchangeName);
			});

			return result
				.then(function() {
					return channel.consume('', function(message) {
						debug('Consume message.');

						// Normalize the message to a standard format so we can switch message queue providers.
						var messageMap = JSON.parse(message.content);

						callback(messageMap);
					}, {noAck: true});
				})
				.then(function() {
					return function() {
						return channel.close();
					};
				});
		});
	*/
};
