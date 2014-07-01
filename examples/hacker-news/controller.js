'use strict';

var fire = require('../..');

// Initialize the app.
var app = fire.app('Hacker News', {
	autoMigrate: true
});

// Create the Article model.
function Article() {
	this.title = [this.String, this.Required];
	this.url = [this.String, this.Required];
	this.votes = [this.Integer, this.Default(0)];
}
app.model(Article);

// Create the NewsController. This is run on the client-context in angular.
function NewsController(fire, $scope) {
	// fire is an angular service. Through models, it exposes all public models from the server-context to the client-context. Under the hood, a RESTful API is generate on the server-context, which the client-context queries to create, read, update and delete models.
	$scope.articles = fire.models.Article.find();
	$scope.article	= {};

	$scope.createArticle = function(article) {
		return fire.models.Article.create(article)
			.then(function(insertedArticle) {
				$scope.articles.push(insertedArticle);
				$scope.article = {};
			})
			.catch(function(error) {
				alert(error);
			});
	};

	$scope.voteArticle = function(article) {
		article.votes++;

		fire.models.Article.update(article);
	};
}
app.controller(NewsController);

// This creates a route to GET / and returns the html. Learn more about [creating routes](https://github.com/martijndeh/fire/wiki/Routes).
NewsController.prototype.view = function() {
	return this.template('list.html');
};

app.run();
