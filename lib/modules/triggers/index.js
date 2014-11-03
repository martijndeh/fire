'use strict';

exports = module.exports = Triggers;

var utils = require('./../../helpers/utils');
var MessageQueue = require('./../message-queue');
var debug = require('debug')('fire:triggers');
var path = require('path');
var Trigger = require('./trigger');

function Triggers(app) {
	this.app = app;
	this._constructors = {};
	this._triggers = [];

	var self = this;
	app.trigger = function(triggerConstructor) {
		self.trigger(triggerConstructor);
		return app;
	};
}
Triggers.prototype.ignoreDisabled = false;
Triggers.prototype.enableModuleProperty = true;

Triggers.prototype.trigger = function(triggerConstructor) {
	if(!triggerConstructor.name) {
		throw new Error('Trigger constructor should contain a name.');
	}

	this._constructors[triggerConstructor.name] = triggerConstructor;
};

Triggers.prototype.setup = function(basePath) {
	if(basePath) {
		debug(path.join(basePath, 'triggers'));

		utils.requireDirSync(path.join(basePath, 'triggers'));
	}

	this.messageQueue = MessageQueue.factory();

	if(!this.messageQueue && Object.keys(this._constructors).length > 0) {
		throw new Error('No message queue created, but a few workers found. Did you specify a connection string for a message queue system e.g. AMQP_URL?');
	}

	if(this.messageQueue) {
		var self = this;
		return this.messageQueue.connect()
			.then(function() {
				self._triggers = Object.keys(self._constructors).map(function(name) {
					var constructor = self._constructors[name];
					return self.createTrigger(constructor);
				});

				// TODO: Start listening to the triggers?!
			});
	}
};

Triggers.prototype.createTrigger = function(triggerConstructor) {
	var trigger = new triggerConstructor();
	Trigger.call(trigger, triggerConstructor.name, this.app.moduleProperties);
	return trigger;
};

Triggers.prototype.start = function(argv) {
	if(argv.triggers || argv.trigger) {
		// Start one or multiple triggers
	}
	else {
		//
	}
};

Triggers.prototype.stop = function() {

};

Triggers.prototype.parseHook = function(modelInstance, hookName) {
	//
};
