'use strict';

var path = require('path');
var config = require('./helpers/config');
var util = require('util');
var argv = require('minimist')(process.argv.slice(2));

function Firestarter() {

}
	
Firestarter.prototype.app = function(options) {
	config.basePath = path.resolve('./');

	// TODO: Implement workers again.

	/*
			var startWorkerWithName = argv.worker || argv.w;
			var startAllWorkers = argv['all-workers'];
			if(startWorkerWithName || startAllWorkers) {
				return Q.all([
					app.models.setup(path.join(config.basePath, 'models')),
					app.workers.setup(path.join(config.basePath, 'workers'))
				])
				.then(function() {
					if(startAllWorkers) {
						return app.workers.startAll();
					}
					else {
						return app.workers.start(startWorkerWithName);
					}
				})
	*/
	return new (require('./app'))(options);
};

Firestarter.prototype.model = function(modelConstructor, options) {
	util.inherits(modelConstructor, require('./modules/models/model'));

	modelConstructor.prototype.options = options || {};
};

Firestarter.prototype.controller = function(controllerConstructor) {
	util.inherits(controllerConstructor, require('./modules/controllers/controller'));
};

exports = module.exports = new Firestarter();