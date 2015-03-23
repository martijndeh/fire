exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String]
	});
	this.models.createModel('ClockTaskResult', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('TriggerResult', {
		id: [this.UUID, this.CanUpdate(false)],
		triggerName: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')],
		subject: [this.UUIDType, this.Required]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('ClockTaskResult');
	this.models.destroyModel('TriggerResult');

};
