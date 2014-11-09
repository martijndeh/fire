'use strict';

exports = module.exports = Schedulers;

var utils = require('./../../helpers/utils');
var util = require('util');
var path = require('path');
var debug = require('debug')('fire:schedulers');

var Scheduler = require('./scheduler');
var MessageQueue = require('./../message-queue');

/**
* The schedulers module.
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
*/
Schedulers.prototype.setup = function(basePath) {
	var self = this;

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
		return this.messageQueue.connect()
			.then(function() {
				Object.keys(self._constructors).forEach(function(schedulerName) {
					self.addSchedulerConstructor(self._constructors[schedulerName]);
				});
			})
			.then(function() {
				return self.startIntervals();
			});
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
