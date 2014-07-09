exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.Id, this.Update(false)],
		name: [this.String, this.Authenticate, this.Unique],
		articles: [this.HasMany(this.models.Article)],
		accessControl: [this.Read(function () { return true; }), this.Update(function () { return false; })]
	});
	this.models.createModel('Article', {
		id: [this.Id, this.Update(false)],
		title: [this.String, this.Required],
		url: [this.String, this.Required, this.Update(false), this.Unique],
		votes: [this.Integer, this.Default(0)],
		createdAt: [this.DateTime, this.Default('CURRENT_DATE')],
		author: [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch],
		accessControl: [this.Read(function () { return true; }), this.Update('author'), this.Delete(function () { return false; })]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('Article');

};
