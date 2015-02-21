'use strict';

exports = module.exports = Schedulers;

var utils = require('./../../helpers/utils');
var util = require('util');
var path = require('path');
var debug = require('debug')('fire:schedulers');

var Scheduler = require('./scheduler');
var MessageQueue = require('./../message-queue');

/**
* The schedulers module. This module allows you to execute tasks during a cron-like time pattern. If you want to execute tasks after a certain action, have a look at the {@link Triggers} module instead. If you need actions to be executed real time (after a given action), consider executing workers in your model hooks instead.
*
* To create a scheduler which runs every minute:
* ```
* function ReportsScheduler() {
* 	// Runs every minute at 0 seconds.
* 	this.timingPattern = '0 * * * * *';
* }
* app.scheduler(ReportsScheduler);
*
* ReportsScheduler.prototype.run = function() {
* 	// Do something. Make sure to return a promise.
* }
* ```
*
* The `timingPattern` allows you to set when to run your scheduler exactly. The format is cron-like. You can set 6 different values in the pattern each separated with a space in the following order:
*
* 1. Seconds: 0-59
* 2. Minutes: 0-59
* 3. Hours: 0-23
* 4. Day of Month: 1-31
* 5. Months: 0-11
* 6. Day of Week: 0-6
*
* The `*` character indicates a wildcard and matches everything. For example, to run a scheduler:
*
* - every minute on the 30th second: `30 * * * * *`.
* - every hour: `0 0 * * * *`
* - every hour every day in January: `0 0 * * 1 *`
*
* You can also use a range.
*
* - every weekday at 11:30 AM: `0 30 11 * * 1-5`
*
* To read about more advanced patterns have a look at {@link https://github.com/ncb000gt/node-cron} and {@link http://crontab.org}.
*
* Internally the schedulers module uses the {@link Clock} module, which guarantees your schedulers are run, even if your server processes crash right before the task should be scheduled and the processes start again right after the processes should've been scheduled. If multiple tasks were skipped, only one task is run. For example, you have a scheduler to run every hour, and your server crashes and is down for 4 hours. When your server, and Node on Fire, start again, your scheduler will notice it skipped several runs. It will run once after the crash, but not 4 times.
*
* You can store your schedulers in the `schedulers/` folder which will automatically load.
*
* Please make sure you have a worker declared in your `Procfile` to actually execute schedulers. You need just one worker with the `--schedulers` argument:
* ```
* worker: node index.js --schedulers
* ```
*
* Please make sure a clock process type is defined in your `Procfile` or your schedulers will *not* work:
* ```
* clock: node index.js --clock
* ```
*
* @param {App} app The app.
* @constructor
*/
function Schedulers(app) {
	this.app 		= app;
	this.messageQueue = null;
	this._schedulersMap = {};
	this._constructors = {};

	this.queueName = 'schedulers';

	var self = this;
	app.scheduler = function(schedulerConstructor) {
		self.scheduler(schedulerConstructor);
		return app;
	};
}
Schedulers.prototype.ignoreDisabled = false;
Schedulers.prototype.enableModuleProperty = true;

/**
* Connects to the message queue, see {@link MessageQueue.factory}.
*
* @access private
*/
Schedulers.prototype.setup = function(basePath) {
	debug('Schedulers#setup');

	if(basePath) {
		debug(path.join(basePath, 'schedulers'));

		utils.requireDirSync(path.join(basePath, 'schedulers'));
	}

	this.messageQueue = MessageQueue.factory();

	if(!this.messageQueue && Object.keys(this._constructors).length > 0) {
		throw new Error('No message queue created, but a few workers found. Did you specify a connection string for a message queue system e.g. AMQP_URL?');
	}

	if(this.messageQueue) {
		Object.keys(this._constructors).forEach(function(schedulerName) {
			this.addSchedulerConstructor(this._constructors[schedulerName]);
		}, this);
		return this.startIntervals();
	}
};

Schedulers.prototype.start = function(argv) {
	if(argv.schedulers) {
		return this.startConsumingTasks();
	}

	return false;
};

/**
* This method is invoked when the process quits. Does clean up: closes the message queue's connection.
*
* @access private
*/
Schedulers.prototype.stop = function() {
	return this.messageQueue && this.messageQueue.disconnect();
};

Schedulers.prototype.startScheduler = function(schedulerName) {
	debug('Schedulers#startScheduler ', schedulerName);

	return this.messageQueue.createTask(this.queueName, {
		schedulerName: schedulerName
	});
};

Schedulers.prototype.startIntervals = function() {
	var self = this;
	Object.keys(this._schedulersMap).forEach(function(schedulerName) {
		var scheduler = self._schedulersMap[schedulerName];

		self.app.clock.addTask(scheduler.timingPattern, schedulerName, function() {
			return self.startScheduler(schedulerName);
		});
	});
};

/**
* Starts consuming messages in the workers specified by `workerNames`. This is invoked in the worker processes.
*
* @access private
*
* @param {String[]} workerNames Only the workers with it's name in this array are started. This is a required argument.
*/
Schedulers.prototype.startConsumingTasks = function() {
	debug('Schedulers#startConsumingTasks');

	var self = this;
	return this.messageQueue.startConsumingTasks(this.queueName, function(messageMap) {
		var scheduler = self._schedulersMap[messageMap.schedulerName];

		debug('Schedulers#consumeTask', messageMap.schedulerName, scheduler);

		if(scheduler) {
			return scheduler.run();
		}
	});
};

/**
* @access private
*
* Initializes the scheduler object.
*
* @access private
*
* @param {Constructor} schedulerConstructor The scheduler constructor.
*/
Schedulers.prototype.addSchedulerConstructor = function(schedulerConstructor) {
	var schedulerName = schedulerConstructor.name;

	debug('Create scheduler `' + schedulerName + '`.');

	var scheduler = new schedulerConstructor();
	Scheduler.call(scheduler, this.app.moduleProperties);

	this._schedulersMap[schedulerName] = scheduler;
};

Schedulers.prototype.scheduler = function(schedulerConstructor) {
	util.inherits(schedulerConstructor, Scheduler);

	this._constructors[schedulerConstructor.name] = schedulerConstructor;
};
