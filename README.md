#### Under active development. Not feature-complete yet and currently unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire
A productive & convention-based web framework to get your minimum viable product ready in no-time and built on top of [AngularJS](https://angularjs.org/) and [express](http://expressjs.com/).

### Installation
```
npm install fire
```

### Features
- Easy client- and server-context switching.
- Naming convention-based routing system.
- Migration-based schema creation.
- Automatic RESTful API generation.
- All promise-based.
- Integrates express, AngularJS and Postgres.

### Philosophy

A framework which allows you to write both client- and server-side code with as much reusability as possible in one language to rule them all to speed up iterations while embracing existing technologies instead of replacing them.

### Example

The below annotated example shows how easy it is to create a Hacker News-esque website.

```js
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
	// fire is an angular service. Throught models, it exposes all public models from the server-context to the client-context. Under the hood, a RESTful API is generate on the server-context, which the client-context queries to create, read, update and delete models.
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
```

For the sake of the example, everything is included in one file. It's generally a better idea to place your models in the `models/` directory and controllers in the `controllers/` directory.

### To do
- Proper built-in authentication: simple to configure, but role based and per model. Models all private unless configured otherwise.
- Align angular api with fire api (e.g. Q with $q).
- Better querying of models: sort, limit, offset.
- Clean-up tests. They aren't promise-based and especially DRY.
- A worker system to easily execute code on worker processes—as if you are calling a regular function—and a caching system (probably RabbitMQ and Redis integration).
- Client-side caching of model instances.