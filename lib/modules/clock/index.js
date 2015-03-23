'use strict';

exports = module.exports = Clock;

var ClockTask = require('./clock-task');
var ClockTaskResult = require('./clock-task-result');
var util = require('util');
var Model = require('./../models/model');
var Q = require('q');

/**
 * The clock module is responsible for the clock process type. The clock process schedules tasks to run at scheduled time intervals in your worker processes. The clock module is used by e.g. the Triggers and the Scheduler module. The clock module guarantees to schedule tasks without skipping an interval.
 *
 * Because the clock process might at some point restart or crash and potentially skip a scheduled tasks, the clock process checks at startup if it skipped any task based on the date of the previous executed task. If it identifies a skipped task, it'll schedule the task immediately.
 *
 * For example, consider a task which sends a mail to all users every month at the 1st day of the month at 13:00 hour exactly. If the clock process crashes at 12:59 hour and starts again at 13:01 the time interval was skipped. The clock module recognizes this and schedules the task at 13:01 instead.
 *
 * (When the clock module starts the first time, and there are no results, it inserts a fake clock result).
 *
 * To start the clock process simply invoke the app with the `--clock` argument. For example, add the following entry to your `Procfile`:
 * ```
 * clock: node index.js --clock
 * ```
 *
 * @param {App} app
 * @constructor
 */
function Clock(app) {
	this.app = app;
	this._tasks = [];
}
Clock.prototype.stages = ['build', 'release', 'run'];
Clock.prototype.enableModuleProperty = true;

Clock.prototype.migrate = function(models) {
	if(typeof models.ClockTaskResult == 'undefined') {
		util.inherits(ClockTaskResult, Model);
		ClockTaskResult.disableAutomaticModelController = true;
		models.addModelConstructor(ClockTaskResult);
	}
};

Clock.prototype.setup = function() {
	if(this.app) {
		this.app.moduleProperties.set(this);
	}

	this.migrate(this.models);
};

/**
 * Creates a task to run at a time interval. The callback is guaranteed to run. The callback should schedule a job on a worker process and not actually execute any work.
 *
 * Check the Schedule or Trigger modules instead if you want to schedule periodic tasks.
 *
 * @param {String}   timingPattern A cron-style timing pattern. For more information, see https://github.com/ncb000gt/node-cron.
 * @param {String}   taskName      The name of the task to run.
 * @param {Function} callback      The function which schedules a job on a worker process.
 */
Clock.prototype.addTask = function(timingPattern, taskName, callback) {
	var task = new ClockTask(timingPattern, taskName, callback);

	if(this.app) {
		// Makes models available on trigger task.
		this.app.moduleProperties.set(task);
	}

	this._tasks.push(task);
	return task;
};

/**
 * Starts all the tasks.
 *
 * @access private
 */
Clock.prototype.startTasks = function() {
	return Q.all(this._tasks.map(function(task) {
		return task.start();
	}));
};

/**
 * Executed when the app starts. Starts all the tasks if the app is started with the clock argument e.g. `node index.js --clock`.
 *
 * @access private
 */
Clock.prototype.start = function(argv) {
	if(argv.clock) {
		return this.startTasks();
	}
};

/**
 * Stops all the tasks. This is executed when the app is killed.
 */
Clock.prototype.stop = function() {
	return Q.all(this._tasks.map(function(task) {
		return Q.when(task.stop());
	}));
};
