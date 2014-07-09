'use strict';

var fire = require('../..');
var app = fire.app('Todos', {modules:['ngRoute']});

/**

    psql=# CREATE USER todos WITH PASSWORD 'password';
    psql=# CREATE DATABASE todos;
    psql=# GRANT ALL PRIVILEGES ON DATABASE todos TO todos;

    DATABASE_URL=postgres://todos:password@127.0.0.1/todos ./../../bin/fire migrate
    DATABASE_URL=postgres://todos:password@127.0.0.1/todos node web.js

**/

app.template('login', '<div ng-controller="LoginController"><h1>Log in</h1><input type="text" ng-model="user.name"/><input type="password" ng-model="user.password"/><button ng-click="logIn(user)">Log in</button><button ng-click="register(user)">Register</button></div>');
app.template('list', '<div ng-controller="ItemsController"><h1>Todo</h1><form ng-submit="createItem(item)"><input type="text" ng-model="item.name"/></form><ul><li ng-repeat="item in user.items|filter:!!item.finished" ng-click="finishItem(item)">{{item.name}}</li><li style="text-decoration:line-through" ng-repeat="item in user.items|filter:!item.finished">{{item.name}} (Finished)</li><ul></div>');

function User() {
    this.name = [this.String, this.Required, this.Authenticate];
    this.items = [this.HasMany(this.models.Item), this.AutoFetch];
}
app.model(User);

function Item() {
    this.name = [this.String, this.Required];
    this.finished = [this.Boolean, this.Default(false)];
    this.user = [this.BelongsTo(this.models.User), this.Automatic];
}
app.model(Item);

function LoginController(fire, $scope, $location) {
    function unwrapUser(userPromise) {
        userPromise
            .then(function(user) {
                $location.path('/');
            })
            .catch(function(error) {
                alert(error);
            });
    }

    $scope.logIn = function(user) {
        unwrapUser(fire.models.User.authorize(user));
    };

    $scope.register = function(user) {
        unwrapUser(fire.models.User.create(user));
    };
}
app.controller(LoginController);

LoginController.prototype.viewLogin = function() {
    return this.template('login');
};

function ItemsController(fire, $scope, $location) {
    fire.models.User.getMe()
        .then(function(user) {
            $scope.user = user;
        })
        .catch(function(error) {
            $location.path('/login');
        });

    $scope.createItem = function(newItem) {
        fire.models.Item.create(newItem)
            .then(function(item) {
                $scope.user.items.push(item);
                $scope.item = null;
            })
            .catch(function(error) {
                alert(error);
            });
    };

    $scope.finishItem = function(item) {
        item.finished = !item.finished;
        fire.models.Item.update(item.id, {finished: item.finished});
    };
}
app.controller(ItemsController);

ItemsController.prototype.view = function() {
    return this.template('list');
};

app.run();
