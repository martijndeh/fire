exports = module.exports = TestSession;

function TestSession(TestModel, TestParticipantModel) {
	this.test = [this.BelongsTo(TestModel), this.Required];
	this.participant = [this.BelongsTo(TestParticipantModel)];
	this.variant = [this.String, this.Required];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
}
