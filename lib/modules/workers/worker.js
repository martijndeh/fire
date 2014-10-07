'use strict';

exports = module.exports = Worker;

var Q = require('q');
var debug = require('debug')('fire:worker');

/**
 * The worker class. See {@link App#worker}.
 *
 * @param {AMQP.Connection} connection The connection to the message queueing system.
 * @param {String} workerName The name of the worker. By default the name of the worker is used as the queue it's consuming on and publishing to.
 * @param {Models} models     The models module.
 * @param {Workers} workers    The workers module.
 *
 * @constructor
 */
function Worker(connection, workerName, models, workers) {
	this.connection = connection;
	this.queueName 	= workerName;
	this.models = models;
	this.workers = workers;
}

/**
 * Consumes a single message received from the message queue.
 *
 * Parses the message's contents, deserializes the JSON, and invoked the method which was invoked.
 *
 * This method returns a promise. If the promise is resolved, the message is acknowledged. If the promise is rejected, the message is not acknowledged and thus will be re-published to the queue at a later time.
 *
 * @param {AMQP.Message} message The AMQP message.
 */
Worker.prototype.consumeMessage = function(message) {
	debug('Worker#consumeMessage');

	var map = JSON.parse(message.content);

	return this[map.methodName].apply(this, map.params);
};

/**
 * Starts consuming message the queue. The name of the queue is the name of the worker.
 */
Worker.prototype.startConsuming = function() {
	debug('Worker#startConsuming');

	var self = this;
	return this.connection.createChannel()
		.then(function(channel) {
			channel.assertQueue(self.queueName);

			channel.consume(self.queueName, function(message) {
				Q.when(self.consumeMessage(message))
					.then(function() {
						channel.ack(message);
					})
					.fail(function(error) {
						// We are not acknoldiging the message if consumeMessage rejects with an error.

						// TODO: Should we send a nack message?

						debug(error);
					})
					.done();
			});
		});
};

/**
 * Publishes a message from a process to a worker process and invoked the method with name `methodName` on the worker process with the arguments in `params`.
 *
 * @param {String} methodName The name of the method to invoke.
 * @param {Array} params     An array of arguments.
 */
Worker.prototype.publishMessage = function(methodName, params) {
	debug('Worker#publishMessage `' + methodName + '`.');

	var self = this;
	return this.connection.createChannel()
		.then(function(channel) {
			channel.assertQueue(self.queueName);
			return channel.sendToQueue(self.queueName, new Buffer(JSON.stringify({
				methodName: methodName,
				params: params
			})));
		});
};
