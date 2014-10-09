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
function Worker(messageQueue, workerName, moduleProperties) {
	this.messageQueue = messageQueue;
	// TODO: Add exchange name
	this.queueName 	= workerName;

	moduleProperties.set(this);
}

/**
 * Consumes a single message received from the message queue.
 *
 * This method returns a promise. If the promise is resolved, the message is acknowledged. If the promise is rejected, the message is not acknowledged and thus will be re-published to the queue at a later time (depending on the exact implementation).
 *
 * @param {Dictionary} messageMap A map with key `methodName` and `params`. The `methodName` is a string with the name of the method to invoke on the worker object and `params` a list of arguments passed to the worker's method.
 */
Worker.prototype.consumeTask = function(messageMap) {
	debug('Worker#consumeMessage');

	return this[messageMap.methodName].apply(this, messageMap.params);
};

/**
 * Starts consuming messages from the message queue. Whenever a message is received it's passed to {@link Worker#consumeMessage}.
 */
Worker.prototype.startConsumingTasks = function() {
	debug('Worker#startConsuming');

	var self = this;
	return this.messageQueue.startConsumingTasks(this.queueName, function(messageMap) {
		return self.consumeTask(messageMap);
	});
};

/**
 * Creates a task from a process to a worker process and invoked the method with name `methodName` on the worker process with the arguments in `params`.
 *
 * @param {String} methodName The name of the method to invoke.
 * @param {Array} params     An array of arguments.
 */
Worker.prototype.createTask = function(methodName, params) {
	debug('Worker#createTask `' + methodName + '`.');

	return this.messageQueue.createTask(this.queueName, {
		methodName: methodName,
		params: params
	});
};
