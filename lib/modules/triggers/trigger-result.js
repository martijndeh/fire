'use strict';

exports = module.exports = TriggerResult;

function TriggerResult() {
	this.triggerName = [this.String, this.Required];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
	this.subject = [this.UUIDType, this.Required];
}

TriggerResult.prototype.isPrivate = true;
