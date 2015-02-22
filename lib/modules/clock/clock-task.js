'use strict';

exports = module.exports = ClockTask;

var debug = require('debug')('fire:clock');
var cron = require('cron');
var Q = require('q');

function ClockTask(timingPattern, name, callback) {
	this._name = name;
	this._job = new cron.CronJob(timingPattern, this.run.bind(this));
	this._callback = callback;
}

/**
 * This executes the actually task and is invoked by the CronJob at the given time (timingPattern).
 *
 * @return {Promise} Resolves when the task finishes.
 */
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
	debug('Create task result `' + this._name + '`.');

	var self = this;
	return this.models.execute('DELETE FROM clock_task_results WHERE name = ? AND id NOT IN (SELECT id FROM clock_task_results WHERE name = ? ORDER BY created_at DESC LIMIT 24) RETURNING *', [this._name, this._name])
		.then(function() {
			return self.models.ClockTaskResult.create({name: self._name});
		});
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
