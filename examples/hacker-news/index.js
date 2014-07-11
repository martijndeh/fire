'use strict';

var fire = require('../..');

var app = fire.app('Hacker News', {
	modules: ['ngRoute'],
	stylesheets: ['/styles/default.css']
});

function User() {
	this.name 			= [this.String, this.Authenticate, this.Unique];
	this.articles 		= [this.HasMany(this.models.Article, 'author')];
	this.votes 			= [this.HasMany(this.models.Article, 'voters')];
	this.accessControl 	= [this.Read(function() { return false; }), this.Update(function() { return false; })];
}
app.model(User);

function Article() {
	this.title 			= [this.String, this.Required];
	this.url 			= [this.String, this.Required, this.Update(false), this.Unique];
	this.createdAt 		= [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
	this.author 		= [this.BelongsTo(this.models.User, 'articles'), this.Automatic, this.Required, this.AutoFetch];
	this.voters 		= [this.HasMany(this.models.User, 'votes'), this.Private];
	this.votes			= [this.Count('voters')];
	this.position 		= [this.ReadOnly('($count("voters") - 1) / ((EXTRACT(EPOCH FROM current_timestamp - $createdAt) / 3600) + 2)^1.8')];
	this.accessControl 	= [this.Read(function() { return true; }), this.Update('author'), this.Delete(function() { return false; })];
}
app.model(Article);

function NewsController(fire, $scope) {
	$scope.articles = fire.unwrap(fire.models.Article.find({}, {orderBy:{position:1}}), []);
	$scope.user 	= fire.unwrap(fire.models.User.getMe(), {});

	$scope.voteArticle = function(article) {
		fire.doVoteArticle(article.id)
			.then(function(updatedArticle) {
				article.votes = updatedArticle.votes;
				article.position = updatedArticle.position;
			})
			.catch(function(error) {
				alert(error);
			});
	};
}
app.controller(NewsController);

NewsController.prototype.view = function() {
	return this.template('list.jade');
};

NewsController.prototype.doVoteArticle = ['/api/articles/:articleID/voters', function($articleID) {
	var self = this;
	return this.models.Article.getOne({id: $articleID})
		.then(function(article) {
			return article.findVoter(self.findAuthenticator())
				.then(function(voter) {
					if(voter) {
						var error = new Error('Conflict');
						error.status = 409;
						throw error;
					}
					else {
						return article.addVoter(self.findAuthenticator())
							.then(function() {
								return self.models.Article.getOne({id: $articleID});
							});
					}
				});
		});
}];

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
