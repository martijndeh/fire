'use strict';

exports = module.exports = MessageQueueAMQP;

var MessageQueue = require('./..');

var amqp = require('amqplib');
var util = require('util');
var Q = require('q');
var debug = require('debug')('fire:amqp');

/**
 * AMQP implemention of the message queue.
 *
 * @param {String} connectionString The connection string. This is the `AMQP_URL` environment variable.
 */
function MessageQueueAMQP(connectionString) {
	MessageQueue.call(this, connectionString);

	this.connection = null;
}
util.inherits(MessageQueueAMQP, MessageQueue);

/**
 * Connects to the AMQP instance e.g. RabbitMQ and returns the connection instance. If a connection is already established, this method resolves to the already existing connection.
 *
 * @return {Promise}
 */
MessageQueueAMQP.prototype.connect = function() {
	if(this.connection) {
		return Q.when(this.connection);
	}
	else {
		var self = this;
		return amqp.connect(this.connectionString)
			.then(function(connection) {
				self.connection = connection;

				self.connection.on('close', function() {
					self.connection = null;
				});

				return self.connection;
			});
	}
};

/**
 * Disconnects from the AMQP instance if a connection exists.
 *
 * @return {Promise}
 */
MessageQueueAMQP.prototype.disconnect = function() {
	return this.connection && this.connection.close();
};

/**
 * Creates a channel and publishes the implementation specific `taskMap` to queue named `queueName`.
 *
 * @param {String} queueName
 * @param {Dictionary} taskMap
 */
MessageQueueAMQP.prototype.createTask = function(queueName, taskMap) {
	return this.connect()
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			var result = channel.assertQueue(queueName);

			// TODO: Method name and params is workers specific. Use messageMap instead.

			return result.then(function() {
				return channel.sendToQueue(queueName, new Buffer(JSON.stringify(taskMap)));
			});
		});
};

/**
 * Starts consuming tasks on the given queue. Each message gets serialized to a dictionary.
 *
 * @param {String}   queueName The name of the queue.
 * @param {Function} callback  The callback invoked whenever a new message is received. The message is acknowledged only if the callback resolves the returned promise. The message is not acknowledged when the callback returns and rejects the returned promise.
 */
MessageQueueAMQP.prototype.startConsumingTasks = function(queueName, callback) {
	return this.connect()
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			var result = channel.assertQueue(queueName);

			return result.then(function() {
				return channel.consume(queueName, function(message) {
					// Normalize the message to a standard format so we can switch message queue providers.
					var messageMap = JSON.parse(message.content);

					Q.when(callback(messageMap))
						.then(function() {
							// Acknowledge the message if we didn't encounter an error.
							channel.ack(message);
						})
						.fail(function(error) {
							// We are not acknoldiging the message if the callback rejects with an error.

							// TODO: Should we send a nack message?

							debug(error);
						})
						.done();
				});
			});
		});
};

/**
 * Publishes a message to a fanout exchange. This is used for Publish/Subscribe mechanisms to send messages to many consumers at once.
 *
 * @param {String} exchangeName The name of the exchange.
 * @param {Dictionary} messageMap   The message to sent to the consumers. This is JSONified and send directly.
 */
MessageQueueAMQP.prototype.publishMessage = function(exchangeName, messageMap) {
	debug('Publish message ' + exchangeName);

	return this.connect()
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			var result = channel.assertExchange(exchangeName, 'fanout', {});

			return result.then(function() {
				return channel.publish(exchangeName, '', new Buffer(JSON.stringify(messageMap)));
			});
		});
};

/**
 * Starts consuming messages on a fanout exchange named `exchangeName`. This is used for Publish/Subscribe mechanisms, see {@link MessageQueueAMQP#publishMessage}.
 *
 * If you want a work queue type of system, see {@link MessageQueueAMQP#createTask} instead.
 *
 * @param {String}   exchangeName The name of the exchange.
 * @param {Function} callback     [description]
 */
MessageQueueAMQP.prototype.startConsumingMessages = function(exchangeName, callback) {
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

			return result.then(function() {
				return channel.consume('', function(message) {
					debug('Consume message.');

					// Normalize the message to a standard format so we can switch message queue providers.
					var messageMap = JSON.parse(message.content);

					callback(messageMap);
				}, {noAck: true});
			});
		});
};
