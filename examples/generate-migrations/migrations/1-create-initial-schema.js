exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.Id],
		name: [this.String, this.Required],
		password: [this.String],
		email: [this.String],
		value: [this.Integer, this.Default(123)]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');

};
