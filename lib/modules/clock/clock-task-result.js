'use strict';

exports = module.exports = ClockTaskResult;

function ClockTaskResult() {
	this.name = [this.String, this.Required];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
}

ClockTaskResult.prototype.isPrivate = true;
