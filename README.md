[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire :fire:
An isomorphic web framework built on top of [Node.js](https://nodejs.org), [AngularJS](https://angularjs.org/), [PostgreSQL](http://www.postgresql.org/), [Express](http://expressjs.com/), [Knex.js](http://knexjs.org/) and more.

### Express with dependency injection
Dependency injection is also available on the back-end side, which makes creating Express routes super easy.
```js
app.post('/api/users', function(UserModel, request) {
    return UserModel.create(request.body)
        .then(function(user) {
            return user;
        });
});
```

### Isomorphic services
All your services are available on both the front- and back-end. This makes it easy to create isomorphic services. The below `TextService` is available on the front- and back-end.
```js
app.service(function TextService() {
    this.slugify = function(text) {
        return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[àáâãäå]+/g, 'a')
        .replace(/[èéêë]+/g, 'e')
        .replace(/[ìíîï]+/g, 'i')
        .replace(/[òóôõö]+/g, 'o')
        .replace(/[ùúûü]+/g, 'u')
        .replace(/\\s+/g, "")
        .replace(/æ+/g, "ae")
        .replace(/ç+/g, "c")
        .replace(/ñ"+/g, 'n')
        .replace(/œ+/g, "oe")
        .replace(/[ýÿ]+/g, 'y')
        .replace(/\\W+/g, '')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };
});
```

### Easy data model creation
It's easy to declare your data model and all associations (one-to-one, one-to-many and many-to-many).
```js
var fire = require('fire');
var app = fire.app('todomvc');

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

### Integrated A/B testing
It's trivial to create A/B tests. Tests work with your existing analytics service e.g. Mixpanel.
```js
app.controller('/', function StartController(TextOfButtonTest, $scope) {
    if(TextOfButtonTest.getVariant() == 'A') {
        $scope.buttonText = 'Register for FREE';
    }
    else {
        $scope.buttonText = 'Register now';
    };
});
```

### Migration-based schema changes
All changes to your data model are applied in migrations. Migrations are automatically generated based on the changes of your models.
```js
exports = module.exports = Migration;

function Migration() {
	//
}

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

### Config management
All your config is stored in the `.env` file, but you can use the `fire` command line interface to manage the config. You can e.g. set `NODE_ENV` to `production` by invoking `fire config:set NODE_ENV=production` or view your config by invoking `fire config`.
```
$ fire config
DEBUG:
NODE_ENV:     development
SESSION_KEYS: XI4frrvs+z1JU9auFEmOIAtM...FL3di8Eysw==
DATABASE_URL: postgres://martijndeh@127.0.0.1/todomvc
```

### Create workers
Easily create workers which execute background tasks.
```js
function MailWorker() {
	//
}
app.worker(MailWorker);

MailWorker.prototype.sendResetPasswordMail = function(user, resetPassword) {
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
```
It's easy to queue a background task which the worker executes in a worker process.
```js
app.post('/api/forgot-password', function(request, MailWorker, UserModel) {
    return UserModel.getMe(request).then(function(user) {
        return MailWorker.sendResetPassword(user, user.resetPassword);
    });
});
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
$ fire run
```

### Documentation

For additional reading and documentation please visit http://nodeonfire.org/.

### Beta releases

From version `0.41.0` and later, every odd numbered minor release is a beta release. Every even numbered minor release is considered a stable release.

### Questions

Open an issue over at GitHub or send a tweet to [@nodeonfire](http://twitter.com/nodeonfire).
