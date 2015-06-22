'use strict';

exports = module.exports = Workers;

var Worker = require('./worker');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:workers');

var MessageQueue = require('./../message-queue');
var Q = require('q');

/**
 * The Workers module. This module is responsible for the orchestration of worker process types. With workers you can off-load intensive tasks away from the web processes to separate worker processes.
 *
 * There are two types of workers: task-based workers and continuous workers. Task-based workers listen to a work queue and consume tasks. Other processes can tasks to a work queue. Continuous workers simply start work. It's important to understand continuous workers should be able to be restarted at any point.
 *
 * To create a task-based worker:
 *
 * In your controllers and models, you can pass messages to task-based workers. Under the hood, the messages are posted over a message queueing system and consumed by a worker process. For example, consider the below example:
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
 * The below snippet shows how to create a continuous worker. A continuous worker starts tasks in the `run` method.
 *
 * ```
 * app.worker(function MyContinuousWorker() {
 * 	this.run = function() {
 * 		// Start task here.
 * 	};
 * });
 * ```
 *
 * If you want to have a time-based process running, e.g. I want this task to run every sunday at 11 am, have a look at the {@link Scheduler} module.
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

	// The messageQueue may be null if no task-based workers exist.
	this.messageQueue = null;

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

Workers.prototype.startingWorkerNames = function(argv) {
	var workerNames = [];

	if(argv.workers) {
		workerNames = Object.keys(this._workers);
	}
	else if(!Array.isArray(argv.worker)) {
		workerNames = [argv.worker];
	}
	else {
		workerNames = argv.worker;
	}

	return workerNames;
};

Workers.prototype.start = function(argv) {
	if(argv.worker || argv.workers) {
		this.swizzleExternalMethods();

		var startingWorkerNames = this.startingWorkerNames(argv);

		return this.startWorkers(startingWorkerNames);
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

Workers.prototype.getMessageQueue = function() {
	if(!this.messageQueue) {
		this.messageQueue = MessageQueue.factory();
	}

	return this.messageQueue;
};

Workers.prototype.startWorkers = function(workerNames) {
	debug('Start workers: ' + workerNames.join(', '));

	var result = Q.when(true);
	var self = this;
	Object.keys(this._workers).forEach(function(workerName) {
		if(workerNames.indexOf(workerName) >= 0) {
			var worker = this._workers[workerName];

			result = result.then(function() {
				if(worker.isTaskBased()) {
					debug('Start task-based worker `' + workerName + '`');

					return worker.startConsumingTasks(self.getMessageQueue(), workerName);
				}
				else {
					debug('Start continuous worker `' + workerName + '`');

					return self.app.injector.call(worker.run, {}, worker);
				}
			});
		}
	}, this);

	return result;
};

/**
 * @deprecated Please use {@link Workers#startWorkers} instead.
 */
Workers.prototype.startConsumingTasks = function(workerNames) {
	console.log('Deprecated: Workers#startConsumingTasks is deprecated. Please use Workers#startWorkers instead.');

	return this.startWorkers(workerNames);
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

				worker[methodName] = self.createCreateTaskMethod(workerName, methodName).bind(worker);
			}
			else {
				debug('Not replacing `' + methodName + '`.');
			}
		}
	});

	this.swizzleExternalMethods();
};

/**
 * In a multi-app project, external workers are considered workers from another app.
 */
Workers.prototype.swizzleExternalMethods = function() {
	Object.keys(this._externalWorkers).forEach(function(workerName) {
		var worker = this._externalWorkers[workerName];
		for(var methodName in worker) {
			if(!Worker.prototype[methodName] && typeof worker[methodName] == 'function') {
				debug('Replacing `' + methodName + '`.');

				worker[methodName] = this.createCreateTaskMethod(workerName, methodName).bind(worker);
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
Workers.prototype.createCreateTaskMethod = function(workerName, methodName) {
	var self = this;
	return function() {
		var params = [];

		// We need to copy the arguments like this as it's a special object and might leak otherwise.
		for(var i = 0, il = arguments.length; i < il; i++) {
			params.push(arguments[i]);
		}

		return this.createTask(self.getMessageQueue(), workerName, methodName, params);
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

	var worker = this.app.injector.construct(workerConstructor);
	Worker.call(worker, this.app.moduleProperties);

	if(isExternal) {
		this._externalWorkers[workerName] = worker;
	}
	else {
		this._workers[workerName] = worker;
	}

	this[workerName] = worker;

	this.app.injector.register(workerName, worker);
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
