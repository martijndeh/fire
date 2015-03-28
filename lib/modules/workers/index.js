'use strict';

exports = module.exports = Workers;

var Worker = require('./worker');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:workers');

var MessageQueue = require('./../message-queue');
var Q = require('q');

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
 * If you want to have a time-based process running, have a look at the Scheduler module.
 *
 * @param {App} app The app.
 * @constructor
 */
function Workers(app) {
	this.app 		= app;
	this.messageQueue = null;
	this._workers 	= {};
	this._externalWorkers = {};
	this._constructors = {};

	var self = this;
	app.worker = function(workerConstructor) {
		self.worker(workerConstructor);
		return app;
	};
}
Workers.prototype.stages = ['build', 'release', 'run'];
Workers.prototype.enableModuleProperty = true;

/**
 * Connects to the message queue, see {@link MessageQueue.factory}.
 */
Workers.prototype.setup = function(basePath) {
	debug('Workers#setup');

	if(basePath) {
		debug(path.join(basePath, 'workers'));

		this.app.requireDirSync(path.join(basePath, 'workers'), true);
	}

	this.messageQueue = MessageQueue.factory();

	if(!this.messageQueue && Object.keys(this._constructors).length > 0) {
		throw new Error('No message queue created, but a few workers found. Did you specify a connection string for a message queue system e.g. BROKER_URL?');
	}

	if(this.messageQueue) {
		Object.keys(this._constructors).forEach(function(workerName) {
			this.addWorkerConstructor(this._constructors[workerName], false);
		}, this);
		this._constructors = null;

		var appsMap = this.app.container.appsMap;
		Object.keys(appsMap).forEach(function(appName) {
			var externalApp = appsMap[appName];
			if(externalApp != this.app) {
				Object.keys(externalApp.workers._constructors).forEach(function(workerName) {
					this.addWorkerConstructor(externalApp.workers._constructors[workerName], true);
				}, this);
			}
		}, this);
	}
};

/**
 * @returns The number of workers.
 */
Workers.prototype.numberOfWorkers = function() {
	if(this._constructors) {
		return Object.keys(this._constructors).length;
	}

	return Object.keys(this._workers).length;
};

Workers.prototype.start = function(argv) {
	if(argv.worker) {
		this.swizzleExternalMethods();

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

		return Q.when(false);
	}
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

	var result = Q.when(true);

	Object.keys(this._workers).forEach(function(workerName) {
		if(workerNames.indexOf(workerName) >= 0) {
			var worker = this._workers[workerName];

			result = result.then(function() {
				return worker.startConsumingTasks();
			});
		}
	}, this);

	return result;
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

	this.swizzleExternalMethods();
};

Workers.prototype.swizzleExternalMethods = function() {
	Object.keys(this._externalWorkers).forEach(function(workerName) {
		var worker = this._externalWorkers[workerName];
		for(var methodName in worker) {
			if(!Worker.prototype[methodName] && typeof worker[methodName] == 'function') {
				debug('Replacing `' + methodName + '`.');

				worker[methodName] = this.createCreateTaskMethod(methodName).bind(worker);
			}
			else {
				debug('Not replacing `' + methodName + '`.');
			}
		}
	}, this);
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
Workers.prototype.addWorkerConstructor = function(workerConstructor, isExternal) {
	var workerName = workerConstructor.name;

	debug('Create worker `' + workerName + '` external:' + isExternal + '.');

	var worker = new workerConstructor();
	Worker.call(worker, this.messageQueue, workerName, this.app.moduleProperties);

	if(isExternal) {
		this._externalWorkers[workerName] = worker;
	}
	else {
		this._workers[workerName] = worker;
	}

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
