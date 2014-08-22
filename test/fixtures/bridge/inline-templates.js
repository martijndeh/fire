'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('example', []);




app.controller('TestController', [function() {

		}]);

function FireModelInstance(setMap, model, path) {
	this._map = setMap || {};
	this._changes = {};
	this._model = model;
	this._endpoint = path + '/' + this._map.id;
}

FireModelInstance.prototype.refresh = function(otherInstance) {
	this._map = otherInstance._map;
	return this;
};

FireModelInstance.prototype.toQueryValue = function() {
	return this._map.id;
};

FireModelInstance.prototype.save = function() {
	// TODO: Check validation locally.

	var self = this;
	var saveMap = {};
	Object.keys(this._changes).forEach(function(key) {
		var value = self._changes[key];
		if(value && typeof value.toQueryValue != 'undefined') {
			saveMap[key] = value.toQueryValue();
		}
		else {
			saveMap[key] = value;
		}
	});

	return this._model._put(this._endpoint, saveMap)
		.then(function(instance) {
			self._changes = {};
			self._map = instance._map;
			return self;
		});
};

function FireModel($http, $q, models) {
	this.$http = $http;
	this.$q = $q;
	this.models = models;
}

FireModel.prototype._prepare = function(params) {
	var map = {};
	Object.keys(params || {}).forEach(function(key) {
		map[key] = JSON.stringify(params[key]);
	});
	return map;
};

FireModel.prototype._action = function(verb, path, fields) {
	var defer = this.$q.defer();

	var self = this;
	this.$http[verb](path, fields)
		.success(function(result) {
			defer.resolve(self.parseResult(result, path));
		})
		.error(function(data) {
			defer.reject(new Error(data));
		});

	return defer.promise;
};

FireModel.prototype._post = function(path, fields) {
	return this._action('post', path, this._prepare(fields));
};

FireModel.prototype._get = function(path, params) {
	return this._action('get', path, {params: this._prepare(params)});
};

FireModel.prototype._put = function(path, fields) {
	return this._action('put', path, this._prepare(fields));
};

FireModel.prototype.update = function(id, model) {
	var updateMap = {};
	Object.keys(model).forEach(function(key) {
		var value = model[key];
		if(value && typeof value.toQueryValue != 'undefined') {
			updateMap[key] = value.toQueryValue();
		}
		else {
			updateMap[key] = value;
		}
	});

	return this._put(this.endpoint + '/' + id, updateMap);
};

FireModel.prototype._create = function(path, fields) {
	var createMap = {};
	Object.keys(fields).forEach(function(key) {
		var value = fields[key];
		if(value && typeof value.toQueryValue != 'undefined') {
			createMap[key] = value.toQueryValue();
		}
		else {
			createMap[key] = value;
		}
	});

	return this._post(path, createMap);
};

FireModel.prototype.create = function(fields) {
	return this._create(this.endpoint, fields);
};

FireModel.prototype._find = function(path, fields, options) {
	var queryMap = fields || {};

	if(options) {
		queryMap.$options = options;
	}

	return this._get(path, queryMap);
};

FireModel.prototype.find = function(fields, options) {
	return this._find(this.endpoint, fields, options);
};

FireModel.prototype.findOne = function(fields, options) {
	var fieldsMap = fields || {};
	if(fieldsMap.id) {
		var modelID = fieldsMap.id;
		delete fieldsMap.id;

		return this._get(this.endpoint + '/' + fieldsMap.id, fieldsMap);
	}
	else {
		var optionsMap = options || {};
		optionsMap.limit = 1;

		return this.find(fieldsMap, optionsMap)
			.then(function(list) {
				if(list && list.length) {
					return list[0];
				}
				else {
					return null;
				}
			});
	}

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

app.service('FireTestController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
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
        templateUrl: '/templates/test',
        controller: 'TestController'
    });
    


}]);
