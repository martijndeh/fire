'use strict';

var fire = require('../..');
var app = fire.app('Hacker News');

function User() {
	this.name = [this.String, this.Required];
	this.articles = [this.HasMany(this.models.Article, 'submitter')];
	this.votes = [this.HasMany(this.models.Article, 'voters')];
	this.comments = [this.HasMany(this.models.Comment)];
}
fire.model(User);

function Article() {
	this.title = [this.String, this.Required];
	this.url = [this.String, this.Required];
	this.createdAt = [this.DateTime, this.Default('"CURRENT_DATE"')];
	this.submitter = [this.BelongsTo(this.models.User, 'articles'), this.Required, this.AutoFetch];
	this.voters = [this.HasMany(this.models.User, 'votes')];
	this.comments = [this.HasMany(this.models.Comment), this.AutoFetch];
}
fire.model(Article);

function Comment() {
	this.article = [this.BelongsTo(this.models.Article)];
	this.author = [this.BelongsTo(this.models.User), this.AutoFetch];
	this.text = [this.String, this.Required];
}
fire.model(Comment);

function NewsController(fire, $scope) {
	$scope.articles = fire.models.Article.find({});
}
fire.controller(NewsController);

NewsController.prototype.view = function() {
	return '{{articles}}{{title}{{/articles}}';
};

NewsController.prototype.viewArticle = function($id) {
	//
};

app.run();