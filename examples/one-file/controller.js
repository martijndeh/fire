'use strict';

var fire = require('../..');
var app = fire.app('news');

function NewsController(fire, $scope) {
	$scope.articles = fire.NewsController.getArticles();
}
fire.controller(NewsController);

// POST /articles
NewsController.prototype.createArticle = function(title, text) {
	return {
		id: 999,
		title: title,
		text: text
	};
};

// GET /articles
NewsController.prototype.getArticles = function() {
	return [
		{
			id: 1,
			title: 'This is an article',
			text: 'This is some text.'
		},

		{
			id: 2,
			title: 'This is another article',
			text: 'This is some text.'
		},

		{
			id: 3,
			title: 'This is an article',
			text: 'This is some text.'
		},

		{
			id: 4,
			title: 'This is an article',
			text: 'This is some text.'
		},

		{
			id: 5,
			title: 'This is an article',
			text: 'This is some text.'
		}
	];
};

// GET /articles/:id
NewsController.prototype.getArticle = function($id) {
	return {
		id: $id,
		title: 'This is an article.',
		text: 'OK.'
	};
};

NewsController.prototype.getUser = function($id) { return {}; };
NewsController.prototype.getUsers = function() {};
NewsController.prototype.createUser = function(name, email, password) {};
NewsController.prototype.updateUser = function($id) {};

// GET /
NewsController.prototype.view = function() {
	return '{{articles}}{{title}{{/articles}}';
};

NewsController.prototype.t = function() {};

app.run();