exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('Test', {
		id: [this.Id, this.Update(false)],
		name: [this.String, this.Update('test')]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('Test');

};
