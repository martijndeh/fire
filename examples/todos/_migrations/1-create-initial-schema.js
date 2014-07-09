exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.Id, this.Update(false)],
		name: [this.String, this.Required, this.Authenticate],
		items: [this.HasMany(this.models.Item), this.AutoFetch]
	});
	this.models.createModel('Item', {
		id: [this.Id, this.Update(false)],
		name: [this.String, this.Required],
		finished: [this.Boolean, this.Default(false)],
		user: [this.BelongsTo(this.models.User), this.Automatic]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('Item');

};
