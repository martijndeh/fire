exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.User.addProperties({
		testParticipant: [this.HasOne(this.models.TestParticipant)]
	});
	this.models.createModel('Test', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		sessions: [this.HasMany(this.models.TestSession)],
		variants: [this.HasMany(this.models.TestVariant)]
	});
	this.models.createModel('TestParticipant', {
		id: [this.UUID, this.CanUpdate(false)],
		sessions: [this.HasMany(this.models.TestSession)],
		authenticator: [this.BelongsTo(this.models.User)]
	});
	this.models.createModel('TestSession', {
		id: [this.UUID, this.CanUpdate(false)],
		test: [this.BelongsTo(this.models.Test), this.Required],
		participant: [this.BelongsTo(this.models.TestParticipant)],
		variant: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('TestVariant', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		numberOfParticipants: [this.Integer, this.Required],
		test: [this.BelongsTo(this.models.Test), this.Required]
	});

};

Migration.prototype.down = function() {
	this.models.User.removeProperties(['testParticipant']);
	this.models.destroyModel('Test');
	this.models.destroyModel('TestParticipant');
	this.models.destroyModel('TestSession');
	this.models.destroyModel('TestVariant');

};
