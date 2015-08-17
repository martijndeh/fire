# Write apps blazingly fast: Node on Fire
[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
[![License Badge](https://img.shields.io/github/license/martijndeh/fire.svg)](https://github.com/martijndeh/fire/blob/master/LICENSE)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/martijndeh/fire?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

- Website: [nodeonfire.org](http://nodeonfire.org/)
- Documentation: [nodeonfire.org/documentation](http://nodeonfire.org/documentation)

[![Node on Fire Logo](http://nodeonfire.org/images/node-on-fire-github-logo.png)](http://nodeonfire.org/)

An universal JavaScript framework built on top of [Node.js](https://nodejs.org), [AngularJS](https://angularjs.org/), [PostgreSQL](http://www.postgresql.org/), [Express](http://expressjs.com/), [Knex.js](http://knexjs.org/) and more.

With Node on Fire you write apps faster than ever, completely in JavaScript, backed by solid technologies such as PostgreSQL and AngularJS.

Node on Fire includes a list of modules and features to help you write apps faster:

### Dependency injection
Angular's dependency injection is great. That's why, in Node on Fire, that dependency injection is also available in the back-end.

You can even use the simpler [implicit annotation](https://docs.angularjs.org/guide/di#implicit-annotation) because Node on Fire seamlessly replaces implicit annotations with inline array notations in the build phase.
```js
app.post('/api/users', function(UserModel, request) {
    return UserModel.create(request.body)
        .then(function(user) {
            return user;
        });
});
```

### Universal services
When you create a service, it's available on both the front- and the back-end. This makes it easy to re-use code in your UI but also in your back-end logic.
```js
// This creates a GET route and returns 123 from MyService (in the back-end).
app.get('/api/value', function(MyService) {
    return MyService.getValue();
});

// This creates a controller and sets the scope's value to 123 from MyService (in the front-end).
app.controller('/', function MyController(MyService, $scope) {
    $scope.value = MyService.getValue();
});

// This is an universal service, available in both the front- and the back-end.
app.service(function MyService() {
    this.getValue = function() {
        return 123;
    };
});
```

### Data model (ORM)
It's easy to declare your data model and all associations (one-to-one, one-to-many and many-to-many).
```js
app.model(function TodoItem(TodoListModel) {
	this.list = [this.BelongsTo(TodoListModel), this.Required];
	this.name = [this.String, this.Required];
	this.completed = [this.Boolean, this.Required, this.Default(false)];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
});

app.model(function TodoList(TodoItemModel) {
	this.items = [this.HasMany(TodoItemModel), this.AutoFetch];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
});
```

### Migrations
All changes to your data model are applied through migrations. This makes it super easy to share your data model. You do not need to write migrations yourself, instead, migrations are generated automatically based on the changes of your models.
```js
Migration.prototype.up = function() {
	this.models.createModel('TodoItem', {
		id: [this.UUID, this.CanUpdate(false)],
		list: [this.BelongsTo(this.models.TodoList), this.Required],
		name: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});

	this.models.createModel('TodoList', {
		id: [this.UUID, this.CanUpdate(false)],
		items: [this.HasMany(this.models.TodoItem)],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
};

Migration.prototype.down = function() {
	this.models.destroyModel('TodoItem');
	this.models.destroyModel('TodoList');
};
```

### Integrated A/B testing
It's trivial to create A/B tests. Tests work with your existing analytics service e.g. Mixpanel.
```js
function StartController(textOfButtonTest, $scope) {
    if(textOfButtonTest == 'A') {
        $scope.buttonText = 'Register for FREE';
    }
    else {
        $scope.buttonText = 'Register now';
    };
}
app.controller('/', StartController);

StartController.prototype.resolve = function() {
    return {
        textOfButtonTest: function() {
            return TextOfButtonTest.participate();
        }
    };
};
```

### Workers and queues
Workers execute background tasks to off-load intensive tasks from the web process. It is super easy to create workers.

```js
app.worker(function MailWorker() {
    this.sendResetPasswordMail = function(user, resetPassword) {
    	var defer = Q.defer();

    	mandrill('/messages/send', {
    		message: {
    			to: [{
    				email: user.email,
    				name: user.name
    			}],
    			...
    		}
    	}, defer.makeNodeResolver());

    	return defer.promise;
    };
});
```
It's easy to queue a background task from a web process which the worker executes in a worker process.
```js
app.post('/api/forgot-password', function(request, MailWorker, UserModel) {
    return UserModel
        .getMe(request)
        .then(function(user) {
            return MailWorker.sendResetPassword(user, user.resetPassword);
        });
});
```

### Smart caching
To make your app feel even more snappy, Node on Fire utilizes smart caching. Node on Fire instantly shows a result if a cache is available, and quickly replaces it with a fresh version from your back-end.

Node on Fire automatically purges any cache when a related model gets created or updated.

```js
// retrieve a recipe
RecipeModel.findOne({id: $route.params.id}, {autoReload: true, cache: 1000 * 60 * 5})
    .then(function(recipes) {
        // recipes
    });
```

### Config management
All your config is stored in the `.env` file (this file shouldn't be tracked in version control), but you can use the `fire` command line interface to manage the config. You can e.g. set `NODE_ENV` to `production` by invoking `fire config:set NODE_ENV=production` or view your config by invoking `fire config`.
```
$ fire config
DEBUG:
NODE_ENV:     development
SESSION_KEYS: XI4frrvs+z1JU9auFEmOIAtM...FL3di8Eysw==
DATABASE_URL: postgres://martijndeh@127.0.0.1/todomvc
```

## Next steps

### Getting started
Install Node on Fire globally:
```
$ npm install -g fire
```

Create your first app:
```
$ fire apps:create helloworld
```

Run your app:
```
$ cd helloworld/
$ fire serve
```

### Examples

We've created several example project which illustrate the different features of Node on Fire. It's also a good reference to use when starting your first Node on Fire app.

http://nodeonfire.org/examples

### Contribute

Do you want to contribute? Great! We can always use some help. Reach out to us or go ahead and work on a rate limiting module, a `fire watch` feature or something else.

### Beta releases

From version `0.41.0` and later, every odd numbered minor release is a beta release. Every even numbered minor release is considered a stable release.

### Stay up-to-date

Sign up for our newsletter at [nodeonfire.org](http://nodeonfire.org) and we'll occasionally send you updates, tips and other news. No spam.

### Questions

Open an issue over at GitHub or send a tweet to [@nodeonfire](http://twitter.com/nodeonfire).
