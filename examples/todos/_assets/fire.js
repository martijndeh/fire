'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('Todos', ['ngRoute']);




app.controller('LoginController', ['FireLoginController', '$scope', '$location', function(fire, $scope, $location) {
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
}]);

app.controller('ItemsController', ['FireItemsController', '$scope', '$location', function(fire, $scope, $location) {
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
}]);

function FireModel($http, $q) {
	this.$http = $http;
	this.$q = $q;
}

FireModel.prototype._action = function(verb, path, fields) {
	var defer = this.$q.defer();

	this.$http[verb](path, fields)
		.success(function(result) {
			defer.resolve(result);
		})
		.error(function(data) {
			defer.reject(new Error(data));
		});

	return defer.promise;
};

FireModel.prototype._post = function(path, fields) {
	return this._action('post', path, fields);
};

FireModel.prototype._get = function(path, params) {
	return this._action('get', path, {params:params});
};

FireModel.prototype._put = function(path, fields) {
	return this._action('put', path, fields);
};

FireModel.prototype.update = function(id, model) {
	return this._put(this.endpoint + '/' + id, model);
};

FireModel.prototype.create = function(fields) {
	return this._post(this.endpoint, fields);
};

FireModel.prototype.find = function(fields) {
	return this._get(this.endpoint, fields);
};

FireModel.prototype.findOne = function(fields) {
	return this._get(this.endpoint, fields)
		.then(function(list) {
			if(list && list.length) {
				return list[0];
			}
			else {
				return null;
			}
		});
};

FireModel.prototype.getOne = function(fields) {
	var defer = this.$q.defer();
	this.findOne(fields)
		.then(function(model) {
			if(model) {
				defer.resolve(model);
			}
			else {
				defer.reject(new Error('Not Found'));
			}
		});
	return defer.promise;
};


function FireModelUser($http, $q) {
	FireModel.call(this, $http, $q);

	this.endpoint = '/api/users';
}
FireModelUser.prototype = new FireModel();


FireModelUser.prototype.authorize = function(fields) {
	return this._post(this.endpoint + '/authorize', fields);
};

FireModelUser.prototype.getMe = function() {
	var defer = this.$q.defer();

	this._get(this.endpoint + '/me')
		.then(function(authenticator) {
			if(authenticator) {
				defer.resolve(authenticator);
			}
			else {
				defer.reject(new Error('Unauthorized'));
			}
		})
		.catch(function(error) {
			defer.reject(error);
		});

	return defer.promise;
};


function FireModelItem($http, $q) {
	FireModel.call(this, $http, $q);

	this.endpoint = '/api/items';
}
FireModelItem.prototype = new FireModel();




app.service('FireModels', ['$http', '$q', function($http, $q) {
	
	this.User = new FireModelUser($http, $q);
	
	this.Item = new FireModelItem($http, $q);
	
}]);

app.service('FireLoginController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;
    this.models = FireModels;

    
    
    
}]);

app.service('FireItemsController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;
    this.models = FireModels;

    
    
    
}]);


app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);



    
    $routeProvider.when('/login', {
        templateUrl: '/templates/login',
        controller: 'LoginController'
    });
    



    
    $routeProvider.when('/', {
        templateUrl: '/templates/list',
        controller: 'ItemsController'
    });
    


}]);
