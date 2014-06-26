'use strict';

var fire = require('../..');
var app = fire.app('Hacker News');

function Article() {
	this.title = [this.String, this.Required];
	this.url = [this.String, this.Required];
	this.createdAt = [this.DateTime, this.Default('CURRENT_DATE')];
	this.submitter = [this.BelongsTo(this.models.User)];
	this.comments = [this.HasMany(this.models.Comment)];
}
fire.model(Article);

function Comment() {
	this.article = [this.BelongsTo(this.models.Article)];
	this.text = [this.String, this.Required];
}
fire.model(Comment);

function User() {
	this.name = [this.String, this.Required];
	this.articles = [this.HasMany(this.models.Article)];
	this.comments = [this.HasMany(this.models.Comment)];
}
fire.model(User);

function NewsController(fire, $scope) {
	$scope.articles = fire.models.Article.findAll();
}
fire.controller(NewsController);

NewsController.prototype.view = function() {
	return '{{articles}}{{title}{{/articles}}';
};

NewsController.prototype.viewArticle = function($id) {
	//
};

app.run();