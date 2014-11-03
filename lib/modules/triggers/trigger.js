'use strict';

exports = module.exports = Trigger;

function Trigger(name, moduleProperties) {
	this.name = name;

	moduleProperties.set(this);
}

Trigger.prototype.activate = function(uuid, options) {
	//
};
