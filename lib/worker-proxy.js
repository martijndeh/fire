'use strict';

exports = module.exports = WorkerProxy;

function WorkerProxy(queueName, workerClass, workers) {
	this.name = queueName;
	this.originalClass = workerClass;

	var self = this;
	Object.keys(workerClass.prototype).forEach(function(methodName) {
		// TODO: should we assign directly to the class--or use something called defineProperty?		
		self[methodName] = function() {
			return workers.publish(self.name, methodName, Array.prototype.slice.call(arguments));
		};
	});
}

