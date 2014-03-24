#### Under active development. Things break & will likely not work yet.

### Node on Fire
A productive & convention-based web framework.

### Installation
```
npm install fire
```

### Features
- Very productive & super-easy.
- Automatic routing to your controller's method based on naming conventions. No need to manually link routes to controller methods.
- Object-relational mapper. Super-easy syntax to define properties, associations and validations. Supports Postgres, and SQLite as a fallback for tests/rapid application prototyping.
- Migration system to apply or revert changes to your datastore & generate migrations based on changes to your models.
- Integrated publish-subscribe to pass messages to workers.
- Integrated Jade template rendering system and easy passing-around data from controllers to views.
- Promise-based.
- Express/Connect-compatible-ish middleware system.

### Introduction

In your main file e.g. `index.js`:
```js
var fire = require('fire');
var app = fire();
app.run();
```

In ```controllers/``` your first controller called `hello.js`:
```js
function HelloController() {

}

HelloController.prototype.getIndex = function() {
	return {
		text: 'Hello, world.'
	};
}
```
In `views/hello/index.jade`:
```jade
doctype html
html(lang="en")
  head
    title Node on Fire Test
  body
    h1= text
```

Now start your first app by calling your main file e.g. `$ node index.js` and open http://127.0.0.1:3000/ in your browser.

### Routes

Node on Fire automatically builds the routes based on a naming convention. Let's take the following declaration as an example:

```js
HelloController.prototype.getIndex = function(hello, world) { ... }
```

```*Hello*Controller.prototype.getIndex = function(hello, world) { ... }```
*Hello* defines the folder where the view of this route is located.

```HelloController.prototype.*get*Index = function(hello, world) { ... }```
*get* indicates the HTTP verb the route matches to. Can be any value really. It's matching the first lower-case part of a method.

```HelloController.prototype.get*Index* = function(hello, world) { ... }```
*Index* is the view name of this route. It will retrieve the view from view folder. The extension is ignored.

```HelloController.prototype.getIndex = function(*hello, world*) { ... }```
*hello, world* declare the path of the route. In this case it's /hello/world.

See also `examples/hello-world` for a short intro on routes.

### Views

As described in Routes, a view path is defined based on a controller's method, and the return value of a controller's method is passed to the view.

In `examples/hello-world` you will find the below method in the only controller:
```js
Example.prototype.getTest = function() {
	return {
		title: 'Hello, world!',
		user: {
			id: 1,
			name: 'Martijn',
			email: 'a@b.c'
		}
	};
};
```

The return value gets passed to the view and gets rendered. Jade is configured by default.
```
doctype html
html(lang="en")
head
	title= title
body
h1
	| Hello,
	= user.name
p.
	This is Node on Fire's first example.
```

### Models

The below defines a basic User model:
```js
function User(models) {
	this.name = [this.String];
	this.password = [this.String];
	this.email = [this.String];
}
```

Node on Fire works with a migration concept: to actual apply changes to your database, you need to migrate it. You can either manually write your migrations~~, or let Node on Fire generate them for you~~.
