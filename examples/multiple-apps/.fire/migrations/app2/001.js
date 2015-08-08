exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('UserInApp2', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('UserInApp2');

};
