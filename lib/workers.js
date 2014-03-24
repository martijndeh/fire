'use strict';

exports = module.exports = Workers;

var util = require('util');
var Resources = require('./resources');
var path = require('path');
var utils = require('./utils');
var WorkerProxy = require('./worker-proxy');
var amqp = require('amqplib');
var inflection = require('inflection');

function Workers() {
	Resources.call(this);
	this._ = {};
}
util.inherits(Workers, Resources);

Workers.prototype.load = function(fullPath, models) {
	var workerClass = require(fullPath);

	var className = utils.normalizeClassName(workerClass);

	var workerProxy = new WorkerProxy(inflection.pluralize(className).toLowerCase(), workerClass, this);
	this[className] = workerProxy;
	this._[className] = workerProxy;
};

Workers.prototype.publish = function(queueName, methodName, parameters) {
	return amqp.connect(process.env.AMQP_URL)
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			channel.assertQueue(queueName);
			return channel.sendToQueue(queueName, new Buffer(JSON.stringify({
				name: methodName,
				params: parameters
			})));
		})
};

Workers.prototype.getWorkerProxy = function(name) {
	var worker = this._[name];

	if(!worker) {
		//todo: warn about missing worker
		//todo: in dev. do levensthein distance on all names
	}

	return worker;
};

Workers.prototype.consume = function(worker) {
	return amqp.connect(process.env.AMQP_URL)
		.then(function(connection) {
			return connection.createChannel();
		})
		.then(function(channel) {
			channel.assertQueue(worker.name);
			channel.consume(worker.name, function(message) {
				if(message) {
					var messageMap = JSON.parse(message.content.toString());

					if(worker[messageMap.name]) {
						worker[messageMap.name].apply(worker, messageMap.params || []);
					}
					else {
						// TODO: call some sort of undefined thingy?
						console.log('*** WARNING: Unknown ' + worker.name + '#' + messageMap.name);
					}

					// TODO: only acknowledge the message if the worker successfully responds
					channel.ack(message);
				}
			});
		});
};

Workers.prototype.startWorkers = function(workerProxies) {
	var self = this;
	workerProxies.forEach(function(workerProxy) {
		var worker = new workerProxy.originalClass();
		worker.name = workerProxy.name;

		console.log('Start worker ' + worker.name);

		// TODO: set the models...
		// worker.models = 

		self.consume(worker);

		if(worker.initialize) {
			worker.initialize();
		}
	});
};

Workers.prototype.start = function(workerNames) {
	if(!util.isArray(workerNames)) {
		workerNames = [workerNames];
	}

	var self = this;
	var workerProxies = workerNames.map(function(workerName) {
		return self.getWorkerProxy(workerName);
	});

	return this.startWorkers(workerProxies);
};

Workers.prototype.startAll = function() {
	var self = this;
	var workerProxies = Object.keys(this._).map(function(workerName) {
		return self.getWorkerProxy(workerName);
	});
	return this.startWorkers(workerProxies);
};