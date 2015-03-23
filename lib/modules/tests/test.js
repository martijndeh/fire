exports = module.exports = Test;

function Test(TestSessionModel, TestVariantModel) {
	this.name = [this.String, this.Required];
	this.sessions = [this.HasMany(TestSessionModel)];
	this.variants = [this.HasMany(TestVariantModel)];
}
