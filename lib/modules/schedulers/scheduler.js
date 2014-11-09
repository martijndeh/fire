'use strict';

exports = module.exports = Scheduler;

function Scheduler(moduleProperties) {
	moduleProperties.set(this);

	if(!this.timingPattern) {
		this.timingPattern = '0 42 * * * *';
	}
}
