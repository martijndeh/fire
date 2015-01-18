'use strict';

exports = module.exports = MessageQueue;

var MessageQueueAMQP = require('./providers/message-queue-amqp');

/**
 * Factory constructor for the message queue system.
 *
 * Creates an AMQP-based message queueing system if AMQP_URL is set.
 *
 * Currently only AMQP is supported, but it should be very easy to add additional message queue systems.
 *
 * @todo Move this to a separate module instead.
 *
 * @return {MessageQueue} A message queue instance, or null.
 */
MessageQueue.factory = function() {
	var messageQueue = null;

	if(process.env.BROKER_URL) {
		// TODO: Parse the protocol
		messageQueue = new MessageQueueAMQP(process.env.BROKER_URL);
	}
	else if(process.env.AMQP_URL) {
		console.log('Warning: `AMQP_URL` is deprecated. Please switch to using `BROKER_URL`.');
		messageQueue = new MessageQueueAMQP(process.env.AMQP_URL);
	}

	return messageQueue;
};

/**
 * The base message queue class and the MessageQueue module. This should be "subclassed" (prototypal inheritance...) by specific implementations. To create a message queue, use {@link MessageQueue.factory}.
 *
 * @param {String} connectionString The connection string to the message queue.
 * @constructor
 */
function MessageQueue(connectionString) {
	this.connectionString = connectionString;
}

/**
 * Gets invoked when the app is starting, both in the web process and the worker processes.
 *
 * @return {Promise}
 */
MessageQueue.prototype.connect = function() {
	throw new Error('MessageQueue#connect not implemented. Implement this method in the MessageQueue subclass.');
};

/**
 * Gets invoked when the app is shutting down, both the web or the worker process.
 *
 * @return {Promise}
 */
MessageQueue.prototype.disconnect = function() {
	throw new Error('MessageQueue#disconnect not implemented. Implement this method in the MessageQueue subclass.');
};

/**
 * Starts consuming tasks on a specific queue named `queueName`. The exact implementation is up to the subclass.
 *
 * @param {String}   queueName The name of the queue.
 * @param {Function} callback  The callback to invoke whenever a message is received. The callback takes one parameter: a dictionary with the keys `methodName` and `params`. `methodName` is the name of the method to invoke on the worker and `params` the arguments passed to the method.
 */
MessageQueue.prototype.startConsumingTasks = function(queueName, callback) { //jshint ignore:line
	throw new Error('MessageQueue#startConsumingTasks not implemented. Implement this method in the MessageQueue subclass.');
};

/**
 * Publishes a task to a work queue.
 *
 * @param {String} queueName  The queue name to publish to.
 * @param {Dictionary} taskMap Implementation specific information about the task.
 */
MessageQueue.prototype.createTask = function(queueName, taskMap) { //jshint ignore:line
	throw new Error('MessageQueue#createTask not implemented. Implement this method in the MessageQueue subclass.');
};
