'use strict';

exports = module.exports = Workers;

var Worker = require('./worker');
var utils = require('./../../helpers/utils');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:workers');

var MessageQueue = require('./../message-queue');

/**
 * The Workers module. This module is responsible for the orchestration of worker process types.
 *
 * With workers you can off-load intensive tasks away from the web processes to separate worker processes.
 *
 * In your controllers and models, you can pass messages to workers. Under the hood, the messages are posted over a message queueing system and consumed by a worker process. For example, consider the below example:
 *
 * ```js
 * // Our User model.
 *
 * function User() {
 * 	//
 * }
 * app.model(User);
 *
 * User.prototype.afterCreate = function() {
 * 	return this.workers.MailWorker.sendWelcomeMail(this);
 * };
 *
 * // The Mail worker.
 *
 * function MailWorker() {
 * 	//
 * }
 * app.worker(MailWorker);
 *
 * MailWorker.prototype.sendWelcomeMail = function(user) {
 * 	// now send the mail to the user...
 * }
 *
 * // The Procfile
 * web: node index.js
 * worker: node index.js --worker MailWorker
 * ```
 *
 * If you want to have a time-based process running, have a look at the Tasks module.
 *
 * @param {App} app The app.
 * @constructor
 */
function Workers(app) {
	this.app 		= app;
	this.messageQueue = null;
	this._workers 	= {};
	this._constructors = {};

	var self = this;
	app.worker = function(workerConstructor) {
		self.worker(workerConstructor);
		return app;
	};
}
Workers.prototype.ignoreDisabled = false;
Workers.prototype.enableModuleProperty = true;

/**
 * Connects to the message queue, see {@link MessageQueue.factory}.
 */
Workers.prototype.setup = function(basePath) {
	var self = this;

	debug('Workers#setup');

	if(basePath) {
		debug(path.join(basePath, 'workers'));

		utils.requireDirSync(path.join(basePath, 'workers'));
	}

	this.messageQueue = MessageQueue.factory();

	if(!this.messageQueue && Object.keys(this._constructors).length > 0) {
		throw new Error('No message queue created, but a few workers found. Did you specify a connection string for a message queue system e.g. AMQP_URL?');
	}

	if(this.messageQueue) {
		return this.messageQueue.connect()
			.then(function() {
				Object.keys(self._constructors).forEach(function(workerName) {
					self.addWorkerConstructor(self._constructors[workerName]);
				});
			})
			.then(function() {
				self._constructors = null;
			});
	}
};

Workers.prototype.start = function(argv) {
	if(argv.worker) {
		var workerNames;

		if(!Array.isArray(argv.worker)) {
			workerNames = [argv.worker];
		}
		else {
			workerNames = argv.worker;
		}

		return this.startConsumingTasks(workerNames);
	}
	else {
		// TODO: Fix the tests. They are manually invoking swizzleMethods() and are not passing any arguments to Workers#start.
		if(process.env.NODE_ENV != 'test') {
			this.swizzleMethods();
		}
	}

	return false;
};

/**
 * This method is invoked when the process quits. Does clean up: closes the message queue's connection.
 */
Workers.prototype.stop = function() {
	return this.messageQueue && this.messageQueue.disconnect();
};

/**
 * Starts consuming messages in the workers specified by `workerNames`. This is invoked in the worker processes.
 *
 * @param {String[]} workerNames Only the workers with it's name in this array are started. This is a required argument.
 */
Workers.prototype.startConsumingTasks = function(workerNames) {
	if(typeof workerNames == 'undefined' || !Array.isArray(workerNames)) {
		throw new Error('Specify an array of worker names in Workers#startConsumingTasks.');
	}

	debug('Workers#startConsumingTasks');
	debug(workerNames);

	var self = this;
	Object.keys(this._workers).forEach(function(workerName) {
		if(workerNames.indexOf(workerName) >= 0) {
			var worker = self._workers[workerName];
			worker.startConsumingTasks();
		}
	});
};

/**
 * In the web process, swizzles all worker methods so that they are changed to the {@see Worker#publishMessage} variant. In a web process, when invoking a worker's method, a message is published to the message queue and is picked up in the worker process.
 */
Workers.prototype.swizzleMethods = function() {
	var self = this;
	Object.keys(this._workers).forEach(function(workerName) {
		var worker = self._workers[workerName];

		for(var methodName in worker) {
			if(!Worker.prototype[methodName] && typeof worker[methodName] == 'function') {
				debug('Replacing `' + methodName + '`.');

				worker[methodName] = self.createCreateTaskMethod(methodName).bind(worker);
			}
			else {
				debug('Not replacing `' + methodName + '`.');
			}
		}
	});
};

/**
 * @access private
 *
 * Creates a method which replaces an original method and instead sends the methodName and it's arguments through {@see Worker#publishMessage}.
 *
 * @param {String} methodName The name of the method.
 */
Workers.prototype.createCreateTaskMethod = function(methodName) {
	return function() {
		var params = [];

		// We need to copy the arguments like this as it's a special object and might leak otherwise.
		for(var i = 0, il = arguments.length; i < il; i++) {
			params.push(arguments[i]);
		}

		return this.createTask(methodName, params);
	};
};

/**
 * @access private
 *
 * Initializes the worker object.
 *
 * @param {Constructor} workerConstructor The worker constructor.
 */
Workers.prototype.addWorkerConstructor = function(workerConstructor) {
	var workerName = workerConstructor.name;

	debug('Create worker `' + workerName + '`.');

	var worker = new workerConstructor();
	Worker.call(worker, this.messageQueue, workerName, this.app.moduleProperties);

	this._workers[workerName] 	= worker;
	this[workerName] 			= worker;
};

/**
 * Creates the worker. You can create a worker when call {@see App#worker}.
 *
 * @param  {Constructor} workerConstructor The constructor to use.
 */
Workers.prototype.worker = function(workerConstructor) {
	util.inherits(workerConstructor, Worker);

	this._constructors[workerConstructor.name] = workerConstructor;
};
