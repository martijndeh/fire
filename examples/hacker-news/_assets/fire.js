'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('Hacker News', ['ngRoute']);




app.controller('NewsController', ['FireNewsController', '$scope', function(fire, $scope) {
	$scope.articles = fire.unwrap(fire.models.Article.find(), []);
	$scope.user 	= fire.unwrap(fire.models.User.getMe(), {});

	$scope.voteArticle = function(article) {
		article.votes++;

		fire.models.Article.update(article.id, {votes: article.votes});
	};
}]);

app.controller('ArticleController', ['FireArticleController', '$scope', '$routeParams', function(fire, $scope, $routeParams) {
	$scope.article = fire.unwrap(fire.models.Article.findOne({id: $routeParams.id}), {});
}]);

app.controller('SubmitController', ['FireSubmitController', '$scope', '$location', function(fire, $scope, $location) {
	fire.models.User.getMe()
		.then(function(user) {
			$scope.user = user;
		})
		.catch(function(error) {
			$location.path('/login');
		});

	$scope.submitArticle = function(article) {
		fire.models.Article.create(article)
			.then(function() {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
	};
}]);

app.controller('LoginController', ['FireLoginController', '$scope', '$location', function(fire, $scope, $location) {
	$scope.loginUser = function(user) {
		fire.models.User.authorize(user)
			.then(function(user) {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
	};

	$scope.createUser = function(user) {
		fire.models.User.create(user)
			.then(function() {
				$location.path('/');
			})
			.catch(function(error) {
				alert(error);
			});
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


function FireModelArticle($http, $q) {
	FireModel.call(this, $http, $q);

	this.endpoint = '/api/articles';
}
FireModelArticle.prototype = new FireModel();




app.service('FireModels', ['$http', '$q', function($http, $q) {
	
	this.User = new FireModelUser($http, $q);
	
	this.Article = new FireModelArticle($http, $q);
	
}]);

app.service('FireNewsController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
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

app.service('FireArticleController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
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

app.service('FireSubmitController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
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


app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);



    
    $routeProvider.when('/', {
        templateUrl: '/templates/list.jade',
        controller: 'NewsController'
    });
    



    
    $routeProvider.when('/article/:id', {
        templateUrl: '/templates/article.jade',
        controller: 'ArticleController'
    });
    



    
    $routeProvider.when('/submit', {
        templateUrl: '/templates/submit.jade',
        controller: 'SubmitController'
    });
    



    
    $routeProvider.when('/login', {
        templateUrl: '/templates/login.jade',
        controller: 'LoginController'
    });
    


}]);
