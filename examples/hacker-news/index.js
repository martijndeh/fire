'use strict';

var fire = require('../..');

var app = fire.app('Hacker News', {
	modules: ['ngRoute'],
	stylesheets: ['/styles/default.css']
});

function User() {
	this.name = [this.String, this.Authenticate, this.Unique];
	this.articles = [this.HasMany(this.models.Article)];
	this.accessControl = [this.Read(function() { return true; }), this.Update(function() { return false; })];
}
app.model(User);

function Article() {
	this.title = [this.String, this.Required];
	this.url = [this.String, this.Required, this.Update(false), this.Unique];
	this.votes = [this.Integer, this.Default(0)];
	this.createdAt = [this.DateTime, this.Default('CURRENT_DATE')];
	this.author = [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch];
	this.accessControl = [this.Read(function() { return true; }), this.Update('author'), this.Delete(function() { return false; })];
}
app.model(Article);

function NewsController(fire, $scope) {
	$scope.articles = fire.unwrap(fire.models.Article.find(), []);
	$scope.user 	= fire.unwrap(fire.models.User.getMe(), {});

	$scope.voteArticle = function(article) {
		article.votes++;

		fire.models.Article.update(article.id, {votes: article.votes});
	};
}
app.controller(NewsController);

NewsController.prototype.view = function() {
	return this.template('list.jade');
};

function ArticleController(fire, $scope, $routeParams) {
	$scope.article = fire.unwrap(fire.models.Article.findOne({id: $routeParams.id}), {});
}
fire.controller(ArticleController);

ArticleController.prototype.viewArticle = function($id) {
	return this.template('article.jade');
};

function SubmitController(fire, $scope, $location) {
	fire.models.User.getMe()
		.then(function(user) {
			$scope.user = user;
		})
		.catch(function(error) {
			$location.path('/login');
		});

	$scope.submitArticle = function(article) {
		fire.models.Article.create(article)
			.then(function() {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
	};
}
app.controller(SubmitController);

SubmitController.prototype.viewSubmit = function() {
	return this.template('submit.jade');
};

function LoginController(fire, $scope, $location) {
	$scope.loginUser = function(user) {
		fire.models.User.authorize(user)
			.then(function(user) {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
	};

	$scope.createUser = function(user) {
		fire.models.User.create(user)
			.then(function() {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
	};
};
app.controller(LoginController);

LoginController.prototype.viewLogin = function() {
	return this.template('login.jade');
};

app.run();
