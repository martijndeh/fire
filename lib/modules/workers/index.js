'use strict';

exports = module.exports = Workers;

var Worker = require('./worker');
var utils = require('./../../helpers/utils');

var util = require('util');
var path = require('path');
var debug = require('debug')('fire:workers');

var amqp = require('amqplib');

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
 */
function Workers(app) {
	this.app 		= app;
	this.connection = null;
	this._workers 	= {};
	this._constructors = {};
}
Workers.prototype.ignoreDisabled = false;

/**
 * Connects to the AMQP e.g. your RabbitMQ instance. The connection string is taken from the environment variable `AMQP_URL`.
 */
Workers.prototype.setup = function(basePath) {
	var self = this;

	if(basePath) {
		debug(path.join(basePath, 'workers'));

		utils.requireDirSync(path.join(basePath, 'workers'));
	}

	return amqp.connect(process.env.AMQP_URL)
		.then(function(connection) {
			self.connection = connection;
		})
		.then(function() {
			Object.keys(self._constructors).forEach(function(workerName) {
				self.addWorkerConstructor(self._constructors[workerName]);
			});
		});
};

/**
 * Closes the AMQP connection.
 */
Workers.prototype.close = function() {
	return this.connection.close();
};

/**
 * Start consuming in workers. This is invoked in the worker processes. Workers wait for published messages and invoke them when received.
 *
 * @param {String[]} workerNames The workers with a name in this array are only started.
 */
Workers.prototype.startConsuming = function(workerNames) {
	debug('Workers#startConsuming');
	debug(workerNames);

	var self = this;
	Object.keys(this._workers).forEach(function(workerName) {
		if(workerNames.indexOf(workerName) >= 0) {
			var worker = self._workers[workerName];
			worker.startConsuming();
		}
	});
};

/**
 * In the web process, swizzles all worker methods so that they are changed to the {@see Worker#publishMessage} variant.
 */
Workers.prototype.swizzleMethods = function() {
	var self = this;
	Object.keys(this._workers).forEach(function(workerName) {
		var worker = self._workers[workerName];

		for(var methodName in worker) {
			if(!Worker.prototype[methodName] && typeof worker[methodName] == 'function') {
				debug('Replacing `' + methodName + '`.');

				worker[methodName] = self.createPublishMessageMethod(methodName).bind(worker);
			}
			else {
				debug('Not replacing `' + methodName + '`.');
			}
		}
	});
};

/**
 * @api private
 *
 * Creates a method which replaces an original method and instead sends the methodName and it's arguments through {@see Worker#publishMessage}.
 *
 * @param {String} methodName The name of the method.
 */
Workers.prototype.createPublishMessageMethod = function(methodName) {
	console.log('Workers#createPublishMessageMethod `' + methodName + '`.');

	return function() {
		var params = [];

		// We need to copy the arguments like this as it's a special object and might leak otherwise.
		for(var i = 0, il = arguments.length; i < il; i++) {
			params.push(arguments[i]);
		}

		return this.publishMessage(methodName, params);
	};
};

/**
 * @api private
 *
 * Initializes the worker object.
 *
 * @param {Constructor} workerConstructor The worker constructor.
 */
Workers.prototype.addWorkerConstructor = function(workerConstructor) {
	var workerName = workerConstructor.name;

	debug('Create worker `' + workerName + '`.');

	var worker = new workerConstructor();
	Worker.call(worker, this.connection, workerName, this.app.models, this);

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
