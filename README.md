#### Under active development. Not feature-complete yet and unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire
A productive & convention-based web framework.

### Installation
```
npm install fire
```

### Features
- Productive.
- Naming convention-based routing system.
- Persistent models and associations.
- Migration-based schema creation.
- Auto-generate migrations.
- Integrated pub-sub to workers.
- Configurable template system.
- Promise-based.

### Philosophy

Integrated and non-awkward public interface.

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

### Featured Example

An extended model example. Basically this creates a `User` model with a one-to-one association to a Team model. A team model gets created for every new user in the `beforeCreate` hook. After a user is created a welcomes email is send in the `afterCreate` hook.
```
function User() {
	this.name = [this.String, this.Required];
	this.email = [this.String];
	this.team = [this.BelongsTo(this.models.Team)];
}

User.prototype.validateEmail = function(value) {
	return (value && value.indexOf('@') >= 0);	
};

User.prototype.beforeCreate = function() {
	var self = this;
	return this.models.Team.create({name: 'First Team'})
		.then(function(team) {
			self.team = team;
		});
};

User.prototype.afterCreate = function() {
	this.workers.Mail.sendWelcomeMail(this.email, this.name);
};
```

An example users controller which does basic (create, read, update) operations. It hooks-in a JSON controller in which we set a content type and the render method.
```
function UsersController() {
	
}
UsersController.prototype.hooks = require('./json-controller');

// POST /users
UsersController.prototype.createUser = function(users) {
	return this.models.User.create({
		name: this.body.name,
		email: this.body.email
	});
};

// GET /users/:id
UsersController.prototype.getUser = function(users, $id) {
	return this.models.User.findOne({id: $id});
};

// PUT /users/:id
UsersController.prototype.updateUser = function(users, $id) {
	return this.models.User.update({id: $id}, {
		name: this.body.name,
		email: this.body.email
	});
};
```

If you want to learn more about Node on Fire, please check the wiki over at https://github.com/martijndeh/fire/wiki. You can also have a look through the different examples in the `examples/` directory.
