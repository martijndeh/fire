'use strict';

exports = module.exports = Task;

/**
 * The task base class. See {@link Tasks} for more information on the Tasks module.
 *
 * This constructor sets several modules to `this` so that they are available in `Task#run`.
 *
 * @param {Models} models  The models module.
 * @param {Workers} workers The workers module.
 *
 * @constructor
 * @access private
 */
function Task(models, workers) {
	this.models = models;
	this.workers = workers;
}

/**
 * This method is invoked when a task is started. This method should be implemented by a specific task.
 */
Task.prototype.run = function() {
	throw new Error('Task#run not implemented by "subclass". Please implement Task#run in the tasks.');
};
