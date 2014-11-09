'use strict';

exports = module.exports = ClockTask;

var debug = require('debug')('fire:clock');
var cron = require('cron');
var Q = require('q');

function ClockTask(timingPattern, name, callback) {
	this._name = name;
	this._job = new cron.CronJob(timingPattern, this.run);
	this._callback = callback;
}

ClockTask.prototype.run = function() {
	debug('Running clock task. ', this._name);

	var self = this;
	return Q.when(this._callback())
		.finally(function() {
			// the task finished OR failed. Let's insert the CronTask model.
			return self._createTaskResult();
		});
};

ClockTask.prototype._createTaskResult = function() {
	return this.models.ClockTaskResult.create({name: this._name});
};

ClockTask.prototype.checkSkippedTasks = function() {
	var self = this;
	return this.models.ClockTaskResult.findOne({name: this._name}, {orderBy:{createdAt:'desc'}})
		.then(function(clockTaskResult) {
			if(clockTaskResult) {
				var currentDate = new Date();
				var createdAt = clockTaskResult.createdAt;
				createdAt = createdAt.setSeconds(createdAt.getSeconds() + 1);
				var nextDate = self._job.cronTime._getNextDateFrom(createdAt);
				if(nextDate < currentDate) {
					debug('Cron task skipped scheduled time interval. Running immediately now.', 'createdAt:', clockTaskResult.createdAt, 'nextDate:', nextDate, 'currentDate:', currentDate);

					return self.run();
				}
				else {
					debug('Cron task not skipped scheduled time interval. Running immediately now.', clockTaskResult.createdAt, nextDate, currentDate);
				}
			}
			else {
				return self._createTaskResult();
			}
		});
};

ClockTask.prototype.start = function() {
	var self = this;
	return this.checkSkippedTasks()
		.then(function() {
			return self._job.start();
		});
};

ClockTask.prototype.stop = function() {
	return this._job.stop();
};
