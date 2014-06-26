exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.Id],
		name: [this.String, this.Required],
		articles: [this.HasMany(this.models.Article, "submitter")],
		votes: [this.HasMany(this.models.Article, "voters")],
		comments: [this.HasMany(this.models.Comment)]
	});
	this.models.createModel('Article', {
		id: [this.Id],
		title: [this.String, this.Required],
		url: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default("CURRENT_DATE")],
		submitter: [this.BelongsTo(this.models.User, "articles"), this.Required, this.AutoFetch],
		voters: [this.HasMany(this.models.User, "votes")],
		comments: [this.HasMany(this.models.Comment), this.AutoFetch]
	});
	this.models.createModel('Comment', {
		id: [this.Id],
		article: [this.BelongsTo(this.models.Article)],
		author: [this.BelongsTo(this.models.User), this.AutoFetch],
		text: [this.String, this.Required]
	});

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('Article');
	this.models.destroyModel('Comment');

};
