#### Under active development. Not feature-complete yet and currently unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire
A productive & convention-based web framework to get your minimum viable product ready in no-time and built on top of [AngularJS](https://angularjs.org/) and [express](http://expressjs.com/).

### Installation
```
npm install fire
```

### Features

1.  **Mix client- and server-side code**  
	Write client- and server-side code your controller (see the annotated example below).

	It's very easy to switch between the server-context and client-context from your code. Calling a server-side method from the client is as easy as calling a regular method.

	```js
	// A regular angular controller, right.
	function TestController($scope, fire) {
		// This runs on the client-side.
		fire.TestController.doTest(21)
			.then(function(value) {
				// What is value is displayed? That's right.
				// The meaning of life.
				alert(value);
			})
	}
	app.controller(TestController);

	TestController.prototype.doTest = function(value) {
		// This is run on the server-side—and gets invoked from the above TestController.
		// Under the hood, a POST is invoked to /test, run on the server, and returned to the client.
		return (parseInt(value) * 2);
	};
	```

2. **Configuring models**  
	Just declare your models and Node on Fire takes care of schema creation, migrations, associations, automatic RESTful CRUD API creation, and a way to access your models from the client-side. Including proper access control.

	The below annoted example shows some more advanced property types.

	```js
	function User() {
		// Set a default value.
		this.name = [this.String, this.Default('Martijn')];

		// Automatically hash values.
		this.token = [this.String, this.Hash(function(value) {
			var hash = crypto.createHash('md5');
			hash.update(value);
			return hash.digest('hex');
		})];

		// Create two virtual properties: a and b.
		// But only only persist c to the database.
		this.c = [this.Integer, this.Transform(function(a, b) {
			return (a * b);
		})];

		// Create a popular property. When quering on popular instances,
		// only instances with more than 10 comments are returned.
		this.popular = [this.Virtual, this.Select(function(isPopular) {
			if(isPopular) {
				return {
					numberOfComments: {
						$gt: 10
					}
				};
			}
			else {
				return {};
			}
		})];
	}
	```

	See [property types](https://github.com/martijndeh/fire/wiki/Property-Types) to view all the available types. But the current selection should cover most use cases. If not, you can still create a controller to

#### 3. Routing
Create routes

#### x. Promise-based, no callback hell
Sick of callback hell? Of course. Node on Fire uses promises mostly everywhere.

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

For the sake of the example, everything is included in one file. It's generally a better idea to place your models in the `models/` directory and controllers in the `controllers/` directory.

### To do
- Align angular api with fire api (e.g. Q with $q).
- Better querying of models: sort, limit, offset.
- Clean-up tests. They aren't promise-based and especially DRY.
- A worker system to easily execute code on worker processes—as if you are calling a regular function—and a caching system (probably RabbitMQ and Redis integration).
- Client-side caching of model instances.
