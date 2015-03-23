'use strict';

exports = module.exports = Triggers;

var MessageQueue = require('./../message-queue');
var debug = require('debug')('fire:triggers');
var path = require('path');
var Trigger = require('./trigger');
var util = require('util');
var TriggerResult = require('./trigger-result');
var Model = require('./../models/model');

/**
 * The Triggers module allows you to execute tasks once whenever a certain condition matches. For example, send a mail to a user when the user signed up 7 days ago, or send a mail to your user 2 days after their last activity. The Trigger modules guarantees only one task is executed when the condition matches.
 *
 * By default, triggers run every 30 minutes and check their conditions. Triggers were not designed to provide a time-critical solution. If you need near instant timing, consider directly evaluating triggers during your model hooks manually.
 *
 * To create a trigger to send a mail to a user when he or she signed up 7 days ago:
 *
 * ```
 * function MyTrigger() {
 * 	//
 * }
 * app.trigger(MyTrigger);
 *
 * MyTrigger.prototype.select = function() {
 * 	return {createdAt:{$lt: moment().add(-1, 'weeks').toDate()}};
 * };
 *
 * MyTrigger.prototype.run = function(user) {
 * 	return sendMailToTheUser(user);
 * };
 * ```
 *
 * You can store your triggers in the `triggers/` folder which automatically gets loaded.
 *
 * Please also make sure you define a worker process to handle all your triggers. You have to declare one worker process to handle all your triggers. Make sure the following is added to your `Procfile`:
 * ```
 * worker: node index.js --triggers
 * ```
 *
 * Triggers internally use the {@link Clock} module. This means you must declare the clock process type in your `Procfile` as well before triggers work:
 * ```
 * clock: node index.js --clock
 * ```
 *
 * @param {App} app
 * @constructor
 */
function Triggers(app) {
	this.app = app;
	this._constructors = {};
	this._triggersMap = {};
	this.queueName = 'triggers';

	var self = this;
	app.trigger = function(triggerConstructor) {
		self.trigger(triggerConstructor);
		return app;
	};
}
Triggers.prototype.stages = ['build', 'release', 'run'];
Triggers.prototype.enableModuleProperty = true;

/**
 * Creates a trigger.
 *
 * @param  {Constructor} triggerConstructor
 * @return {App}
 */
Triggers.prototype.trigger = function(triggerConstructor) {
	if(!triggerConstructor.name) {
		throw new Error('Trigger constructor should contain a name.');
	}

	util.inherits(triggerConstructor, Trigger);
	this._constructors[triggerConstructor.name] = triggerConstructor;
};

/**
 * The migrate phase which gets called during the build migrations phase.
 *
 * @param  {Models} models The active models.
 */
Triggers.prototype.migrate = function(models) {
	if(typeof models.TriggerResult == 'undefined') {
		util.inherits(TriggerResult, Model);
		models.addModelConstructor(TriggerResult);
	}

	var authenticator = models.getAuthenticator();
	if(authenticator) {
		authenticator._addProperty('triggerResult', [models.getAuthenticator().Where('NOT EXISTS (SELECT * FROM trigger_results WHERE trigger_results.trigger_name = $1 AND trigger_results.subject = ' + authenticator.getTable().name + '.id)')]);
	}
};

Triggers.prototype.numberOfTriggers = function() {
	if(this._constructors) {
		return Object.keys(this._constructors).length;
	}
	
	return Object.keys(this._triggersMap).length;
};

/**
 * Loads the triggers from the `triggers/` folder and initializes the worker queue.
 *
 * @access private
 *
 * @param  {String} basePath The root path of your project.
 * @return {Promise}
 */
Triggers.prototype.setup = function(basePath) {
	debug('Triggers#setup');

	if(this.app) {
		this.app.moduleProperties.set(this);
	}

	this.migrate(this.models);

	if(basePath) {
		debug(path.join(basePath, 'triggers'));

		this.app.requireDirSync(path.join(basePath, 'triggers'));
	}

	this.messageQueue = MessageQueue.factory();

	if(!this.messageQueue && Object.keys(this._constructors).length > 0) {
		throw new Error('No message queue created, but a few triggers found. Did you specify a connection string for a message queue system e.g. AMQP_URL?');
	}

	if(this.messageQueue) {
		Object.keys(this._constructors).map(function(name) {
			var constructor = this._constructors[name];
			var trigger = this.createTrigger(constructor);
			this._triggersMap[trigger.name] = trigger;
		}, this);
		return this.startIntervals();
	}
};

/**
 * Creates and returns a trigger instance from a constructor.
 *
 * @access private
 *
 * @param {Constructor} triggerConstructor The trigger's constructor.
 */
Triggers.prototype.createTrigger = function(triggerConstructor) {
	var trigger = new triggerConstructor();
	Trigger.call(trigger, triggerConstructor.name, this.app.moduleProperties);

	debug('Triggers#createTrigger ', trigger.name);
	return trigger;
};

/**
 * Processes. the trigger. This starts finding the matching subjects and executing the task for every matched subject.
 *
 * @access private
 *
 * @param {Dictionary} messageMap The message received from the message queue.
 * @param {String} messageMap.triggerName The name of the trigger to start.
 */
Triggers.prototype.processTrigger = function(messageMap) {
	var triggerName = messageMap.triggerName;

	debug('Triggers#processTrigger ', triggerName);

	var trigger = this._triggersMap[triggerName];

	if(trigger) {
		return trigger.start();
	}
};

/**
 * Starts a trigger. This method is called from the clock process and sends a task to a worker process to start checking the trigger.
 *
 * @access private
 *
 * @param {Trigger} trigger The trigger instance to check.
 */
Triggers.prototype.startTrigger = function(trigger) {
	debug('Triggers#startTrigger ', trigger.name);

	return this.messageQueue.createTask(this.queueName, {
		triggerName: trigger.name
	});
};

/**
 * Schedules all triggers in the clock process to periodically send tasks to the trigger worker processes. The intervals are managed in the {@see Clock} module.
 *
 * @access private
 */
Triggers.prototype.startIntervals = function() {
	var self = this;
	Object.keys(this._triggersMap).forEach(function(triggerName) {
		var trigger = self._triggersMap[triggerName];

		self.app.clock.addTask(trigger.timingPattern, trigger.name, function() {
			return self.startTrigger(trigger);
		});
	});
};

/**
 * In a worker process, starts listening to the triggers worker queue for tasks.
 *
 * @access private
 */
Triggers.prototype.startConsuming = function() {
	var self = this;

	return this.messageQueue.startConsumingTasks(this.queueName, function(messageMap) {
		return self.processTrigger(messageMap);
	});
};

/**
 * Executed when the app starts. When the app is started with the `--triggers` argument the triggers start waiting for work. If the app is started with the `--clock` argument the intervals a scheduled.
 *
 * @access private
 *
 * @param  {Dictionary} argv Starting arguments.
 * @return {Promise}
 */
Triggers.prototype.start = function(argv) {
	if(argv.triggers) {
		return this.startConsuming();
	}
	else {
		// Nothing
	}
};

/**
 * Stops the triggers.
 *
 * @access private
 */
Triggers.prototype.stop = function() {
	return this.messageQueue && this.messageQueue.disconnect();
};
