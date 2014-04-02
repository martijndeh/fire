exports = module.exports = TestMigration;

function TestMigration() {
	//
}

TestMigration.prototype.up = function() {
	this.models.User.addProperties({
		value: [this.Integer, this.Default(123)]
	});
};

TestMigration.prototype.down = function() {
	this.models.User.removeProperties(['value']);
};
