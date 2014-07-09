'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('Test App', ['ngRoute']);


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



app.service('FireModels', ['$http', '$q', function($http, $q) {
	
}]);


app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


}]);
