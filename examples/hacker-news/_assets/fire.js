'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('Hacker News', []);




app.controller('NewsController', ['FireNewsController', '$scope', function(fire, $scope) {
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
}]);

app.controller('', [function() {}]);

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

FireModel.prototype.update = function(model) {
	return this._put(this.endpoint + '/' + model.id, model);
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


function FireModelArticle($http, $q) {
	FireModel.call(this, $http, $q);

	this.endpoint = '/api/articles';
}
FireModelArticle.prototype = new FireModel();


app.service('FireModels', ['$http', '$q', function($http, $q) {
	/*
	function unwrap(promise, initialValue) {
		var value = initialValue;

		promise.then(function(newValue) {
			angular.copy(newValue, value);
		});

		return value;
	};
	fire.unwrap = unwrap;
	*/

	
	this.Article = new FireModelArticle($http, $q);
	
}]);

app.service('FireNewsController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.models = FireModels;

    
    this.view = function() {
        var defer = $q.defer();

        $http['get']('/', {})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
}]);

app.service('Fire', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.models = FireModels;

    
    this.getArticles = function() {
        var defer = $q.defer();

        $http['get']('/api/articles', {})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    this.updateArticle = function($id) {
        var defer = $q.defer();

        $http['put']('/api/articles/' + id + '', {$id: $id})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    this.getArticle = function($id) {
        var defer = $q.defer();

        $http['get']('/api/articles/' + id + '', {$id: $id})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    this.createArticle = function() {
        var defer = $q.defer();

        $http['post']('/api/articles', {})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    this.deleteModel = function($id) {
        var defer = $q.defer();

        $http['delete']('/api/models/' + id + '', {$id: $id})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
}]);

