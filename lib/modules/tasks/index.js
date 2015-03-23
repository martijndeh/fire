'use strict';

exports = module.exports = Tasks;

var util = require('util');
var Task = require('./task');
var Q = require('q');
var path = require('path');
var debug = require('debug')('fire:tasks');

var utils = require('./../../helpers/utils');

/**
 * The tasks module. Useful to run one-off tasks in a cronjob or manually.
 *
 * To create a task, create a constructor in the `tasks/` folder with a run method:
 * ```js
 * function MyTask() {
 * 	//
 * }
 * app.task(MyTask);
 *
 * MyTask.prototype.run = function() {
 * 	// do something
 * };
 * ```
 *
 * To invoke the task, execute the following: `$ node index.js --task MyTask`.
 *
 * `this.models` and `this.workers` are available in your tasks.
 *
 * @param {App} app
 * @constructor
 */
function Tasks(app) {
	this.app = app;
	this._taskConstructors = {};

	var self = this;
	app.task = function(taskConstructor) {
		util.inherits(taskConstructor, Task);
		self._taskConstructors[taskConstructor.name] = taskConstructor;
		return app;
	};
}

Tasks.prototype.stages = ['run'];

/**
 * Loads the tasks from the `tasks/` folder.
 *
 * Currently the tasks are always loaded even if no tasks are run.
 *
 * @param  {String} basePath The path to the app's directory.
 */
Tasks.prototype.setup = function(basePath) {
	debug('Tasks#setup');

	// TODO: We should need to load this if we are not starting a task.
	if(basePath) {
		debug(path.join(basePath, 'tasks'));

		this.app.requireDirSync(path.join(basePath, 'tasks'));
	}
};

/**
 * Starts the tasks matching `argv.name`. See {@link Tasks}.
 *
 * @param  {Dictionary} argv The arguments passed to the process.
 * @return {Promise}
 */
Tasks.prototype.start = function(argv) {
	if(argv.task) {
		var taskNames;

		if(!Array.isArray(argv.task)) {
			taskNames = [argv.task];
		}
		else {
			taskNames = argv.task;
		}

		return this.run(taskNames);
	}
};

/**
 * Runs all the tasks in `taskNames`.
 *
 * @param  {String[]} taskNames All the task names to run.
 * @return {Promise}           Resolves with an array of promises via `Q#all`.
 */
Tasks.prototype.run = function(taskNames) {
	var tasks = [];

	var self = this;
	taskNames.forEach(function(taskName) {
		var taskConstructor = self._taskConstructors[taskName];

		if(taskConstructor) {
			var task = new taskConstructor();
			Task.call(task, self.app.models, self.app.workers);

			tasks.push(task.run());
		}
		else {
			throw new Error('Cannot find task `' + taskName + '`.');
		}
	});

	return Q.all(tasks);
};
