'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('Hacker News', []);

app.controller('NewsController', ['fire', '$scope', '$q', '$timeout', function(fire, $scope, $q, $timeout) {
	$scope.articles = fire.bind(fire.models.Article.find());

	$scope.createArticle = function(article) {
		return fire.models.Article.create(article)
			.then(function() {
				$scope.articles = fire.bind(fire.models.Article.find());
			})
			.catch(function(error) {
				alert(error);
			});
	};
}]);

app.controller('ModelController', [function() {}]);

app.service('fire', ['$q', '$http', function($q, $http) {	
	function NoF_Model() {

	}

	NoF_Model.prototype._action = function(verb, path, fields) {
		var defer = $q.defer();

		$http[verb](path, fields)
			.success(function(result) {
				defer.resolve(result);
			})
			.error(function(data) {
				defer.reject(new Error(data));
			});

		return defer.promise;
	};

	NoF_Model.prototype._post = function(path, fields) {
		return this._action('post', path, fields);
	};

	NoF_Model.prototype._get = function(path, params) {
		return this._action('get', path, {params:params});
	};

	NoF_Model.prototype._put = function(path, fields) {
		return this._action('put', path, fields);
	};

	NoF_Model.prototype.update = function(model) {
		return this._put(this.endpoint + '/' + model.id, model);
	};

	NoF_Model.prototype.create = function(fields) {
		return this._post(this.endpoint, fields);
	};

	NoF_Model.prototype.find = function(fields) {
		return this._get(this.endpoint, fields);
	};
	NoF_Model.prototype.findOne = function(fields) {
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
	NoF_Model.prototype.getOne = function(fields) {
		var defer = $q.defer();
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

	this.models = {};
	
	function Article() {
		this.endpoint = '/api/v1/articles';
	}
	Article.prototype = new NoF_Model();

	this.models.Article = new Article();
	
	function Comment() {
		this.endpoint = '/api/v1/comments';
	}
	Comment.prototype = new NoF_Model();

	this.models.Comment = new Comment();
	
}]);