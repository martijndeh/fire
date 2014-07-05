exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('Article', {
		id: [this.Id],
		title: [this.String, this.Required],
		url: [this.String, this.Required],
		votes: [this.Integer, this.Default(0)]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('Article');

};
