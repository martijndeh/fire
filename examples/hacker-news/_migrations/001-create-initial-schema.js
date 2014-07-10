exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.Id, this.Update(false)],
		name: [this.String, this.Authenticate, this.Unique],
		articles: [this.HasMany(this.models.Article, "author")],
		votes: [this.HasMany(this.models.Article, "voters")],
		accessControl: [this.Read(function () { return false; }), this.Update(function () { return false; })]
	});
	this.models.createModel('Article', {
		id: [this.Id, this.Update(false)],
		title: [this.String, this.Required],
		url: [this.String, this.Required, this.Update(false), this.Unique],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')],
		author: [this.BelongsTo(this.models.User, "articles"), this.Automatic, this.Required, this.AutoFetch],
		voters: [this.HasMany(this.models.User, "votes"), this.Private],
		votes: [this.Count('voters')],
		position: [this.ReadOnly('($count("voters") - 1) / ((EXTRACT(EPOCH FROM current_timestamp - $createdAt) / 3600) + 2)^1.8')],
		accessControl: [this.Read(function () { return true; }), this.Update('author'), this.Delete(function () { return false; })]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('Article');

};
