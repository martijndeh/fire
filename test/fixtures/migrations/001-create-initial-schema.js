exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('Test', {
		id: [this.Id, this.CanUpdate(false)],
		name: [this.String, this.CanUpdate('test')]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('Test');

};
