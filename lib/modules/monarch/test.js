'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('fire', []);

app.controller('TestController', ['$scope', 'fire', function($scope, fire) {$scope.user = null;
			// Test comment.

			$scope.submit = function() {
				fire.TestController.test()
					.then(function(result) {

					});
			};
		}]);

app.controller('fn7', [function() {
			// Test :) 
			//{
		}]);

app.controller('fn6', [function() {}]);

app.controller('fn5', [function() {}]);

app.controller('fn4', [function() {
     		// Comments remains untouched.
     	}]);

app.controller('fn3', ['param1', 'param2', function(param1, param2) {
			alert('&quot;There.&quot;');
		}]);

app.controller('fn2', [function() {
    		test();
     	}]);

app.controller('fn1', [function() {
        	alert(&quot;/*This is not a comment, it's a string literal*/&quot;);
     	}]);

app.controller('fn0', ['param1', 'param2', function(param1, param2) {
        	/*inside*/
        	execute(param2, param1);
    	}]);


app.service('$models', ['$q', '$http', function($q, $http) {
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
	
	function User() {
		this.endpoint = '/api/v1/users';
	}
	User.prototype = new NoF_Model();

	this.User = new User();
	
	function Pet() {
		this.endpoint = '/api/v1/pets';
	}
	Pet.prototype = new NoF_Model();

	this.Pet = new Pet();
	
}]);