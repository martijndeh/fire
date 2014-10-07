'use strict';

exports = module.exports = Worker;

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
function Worker(messageQueue, workerName, models, workers) {
	this.messageQueue = messageQueue;
	// TODO: Add exchange name
	this.queueName 	= workerName;
	this.models = models;
	this.workers = workers;
}

/**
 * Consumes a single message received from the message queue.
 *
 * This method returns a promise. If the promise is resolved, the message is acknowledged. If the promise is rejected, the message is not acknowledged and thus will be re-published to the queue at a later time (depending on the exact implementation).
 *
 * @param {Dictionary} messageMap A map with key `methodName` and `params`. The `methodName` is a string with the name of the method to invoke on the worker object and `params` a list of arguments passed to the worker's method.
 */
Worker.prototype.consumeMessage = function(messageMap) {
	debug('Worker#consumeMessage');

	return this[messageMap.methodName].apply(this, messageMap.params);
};

/**
 * Starts consuming messages from the message queue. Whenever a message is received it's passed to {@link Worker#consumeMessage}.
 */
Worker.prototype.startConsuming = function() {
	debug('Worker#startConsuming');

	var self = this;
	return this.messageQueue.startConsuming(this.queueName, function(messageMap) {
		return self.consumeMessage(messageMap);
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

	return this.messageQueue.publishMessage(this.queueName, methodName, params);
};
