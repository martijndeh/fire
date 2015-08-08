exports = module.exports = TestVariant;

function TestVariant(TestModel) {
	this.name = [this.String, this.Required];
	this.numberOfParticipants = [this.Integer, this.Required];
	this.test = [this.BelongsTo(TestModel), this.Required];
}
TestVariant.prototype.isPrivate = true;
