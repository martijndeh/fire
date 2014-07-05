#### Under active development. Not feature-complete yet and currently unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire :fire:
A productive & convention-based web framework to get your minimum viable product ready in no-time built on top of [AngularJS](https://angularjs.org/) and [express](http://expressjs.com/).

### Installation
```
npm install fire
```

### Features

1.  **Mix client- and server-side code**  
	It's very easy to switch between the server-context and client-context from your code. Calling a server-side method from the client is as easy as calling a regular method. Everything is JavaScript.

2. **Models and auto-API**  
	You configure your models and Node on Fire :fire: takes care of schema creation, database migrations, associations, automatic RESTful CRUD API generation, and client-side library creation. Plus, you can configure access control and authorization.

4. **Promise-based, no callback hell**  
	Callback hell? Not really. Node on Fire uses promises *mostly* everywhere.

### Philosophy

A framework which allows you to write both client- and server-side code with as much reusability as possible in one language to rule them all to speed up iterations while embracing existing technologies instead of replacing them.

### Example

The below annotated example shows how easy it is to create a Hacker News-esque website.

```js
'use strict';

var fire = require('../..');

// Initialize the app.
var app = fire.app('Hacker News', {});

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
```

To run this example, Node on Fire :fire: first needs to generate some files. For now, you need to do this manually by executing the below two commands:

```
$ fire generate migrations
$ fire generate scripts
```

To create the database, execute the below command:
```
$ DATABASE_URL=... fire migrate
```
where the value of `DATABASE_URL` is the url to your database.

The example uses bower, so you need to install the components:
```
$ bower install
```

Now, you can start your application by calling:
```
$ node controller.js
```

To view the demo, go to http://127.0.0.1:3000/.

### Next Steps

Node on Fire :fire: still has a long way to go. Head over to the `examples/` to start playing with them and read through the library's source code, help us improve it or write documentation.
