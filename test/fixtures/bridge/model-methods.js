'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('example', []);




app.controller('TestController', ['$scope', 'FireTestController', function($scope, fire) {/* jshint ignore:start */$scope.user = null; //jshint ignore:line
			// Test comment.

			$scope.submit = function() {
				fire.TestController.test()
					.then(function(result) {

					});
			};

			/* jshint ignore:end */
		}]);

app.controller('fn7', [function() {
			// Test :)
			//{
		}]);

app.controller('fn6', [function() {}]);

app.controller('fn5', [function() {}]);

app.controller('fn4', [function() { //jshint ignore:line
     		// Comments remains untouched.
     	}]);

app.controller('fn3', ['param1', 'param2', function(param1, param2) { //jshint ignore:line
			/* jshint ignore:start */
			alert('"There."');
			/* jshint ignore:end */
		}]);

app.controller('fn2', [function() {
    		/* jshint ignore:start */
    		test();
    		/* jshint ignore:end */
     	}]);

app.controller('fn1', [function() {
    		/* jshint ignore:start */
        	alert("/*This is not a comment, it's a string literal*/");
        	/* jshint ignore:end */
     	}]);

app.controller('fn0', ['param1', 'param2', function(param1, param2) { //jshint ignore:line
        	/*inside*/
        	/* jshint ignore:start */
        	execute(param2, param1);
        	/* jshint ignore:end */
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

FireModelInstance.prototype.remove = function() {
	return this._model.remove(this._map.id);
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

FireModel.prototype.remove = function(id) {
	return this._action('delete', this.endpoint + '/' + id, {})
};

FireModel.prototype.findOrCreate = function(where, set) {
	var self = this;
	return this.findOne(where)
		.then(function(modelInstance) {
			if(modelInstance) {
				return modelInstance;
			}
			else {
				var createMap = {};
				Object.keys(where || {}).forEach(function(key) {
					createMap[key] = where[key];
				});

				Object.keys(set || {}).forEach(function(key) {
					createMap[key] = set[key];
				});

				return self.create(createMap);
			}
		});
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


function FireModelInstancePet(setMap, model, path) {
	var self = this;

	

	Object.defineProperty(this, 'id', {
		get: function() {
			return self._changes['id'] || self._map['id'];
		},

		set: function(value) {
			self._changes['id'] = value;
		}
	});

	

	Object.defineProperty(this, 'name', {
		get: function() {
			return self._changes['name'] || self._map['name'];
		},

		set: function(value) {
			self._changes['name'] = value;
		}
	});


	FireModelInstance.call(this, setMap, model, path);
}
FireModelInstancePet.prototype = FireModelInstance.prototype;



function FireModelPet($http, $q, models) {
	FireModel.call(this, $http, $q, models);

	this.endpoint = '/api/pets';
}
FireModelPet.prototype = new FireModel();

FireModelPet.prototype.parseResult = function(setMapOrList, path) {
	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
		var self = this;
		return setMapOrList.map(function(setMap) {
			return new FireModelInstancePet(setMap, self, path);
		});
	}
	else {
		return new FireModelInstancePet(setMapOrList, this, path);
	}
};



app.factory('PetModel', ['$http', '$q', 'FireModels', function($http, $q, FireModels) {
	return new FireModelPet($http, $q, FireModels);
}]);

function FireModelInstanceUser(setMap, model, path) {
	var self = this;

	

	Object.defineProperty(this, 'id', {
		get: function() {
			return self._changes['id'] || self._map['id'];
		},

		set: function(value) {
			self._changes['id'] = value;
		}
	});

	

	Object.defineProperty(this, 'name', {
		get: function() {
			return self._changes['name'] || self._map['name'];
		},

		set: function(value) {
			self._changes['name'] = value;
		}
	});

	
	if(typeof setMap.votes != 'undefined' && setMap.votes !== null) {
		if(Array.isArray(setMap.votes)) {
			setMap.votes = setMap.votes.map(function(object) {
				return new FireModelInstanceArticle(object);
			});
		}
		else {
			setMap.votes = new FireModelInstanceArticle(setMap.votes);
		}
	}
	

	Object.defineProperty(this, 'votes', {
		get: function() {
			return self._changes['votes'] || self._map['votes'];
		},

		set: function(value) {
			self._changes['votes'] = value;
		}
	});

	

	Object.defineProperty(this, 'accessControl', {
		get: function() {
			return self._changes['accessControl'] || self._map['accessControl'];
		},

		set: function(value) {
			self._changes['accessControl'] = value;
		}
	});


	FireModelInstance.call(this, setMap, model, path);
}
FireModelInstanceUser.prototype = FireModelInstance.prototype;



FireModelInstanceUser.prototype.createVote = function(map) {
	var self = this;
	return this._model._create(this._model.endpoint + '/' + this.id + '/votes', map)
		.then(function(otherInstance) {
			return self.refresh(otherInstance);
		});
};




function FireModelUser($http, $q, models) {
	FireModel.call(this, $http, $q, models);

	this.endpoint = '/api/users';
}
FireModelUser.prototype = new FireModel();

FireModelUser.prototype.parseResult = function(setMapOrList, path) {
	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
		var self = this;
		return setMapOrList.map(function(setMap) {
			return new FireModelInstanceUser(setMap, self, path);
		});
	}
	else {
		return new FireModelInstanceUser(setMapOrList, this, path);
	}
};



app.factory('UserModel', ['$http', '$q', 'FireModels', function($http, $q, FireModels) {
	return new FireModelUser($http, $q, FireModels);
}]);

function FireModelInstanceArticle(setMap, model, path) {
	var self = this;

	

	Object.defineProperty(this, 'id', {
		get: function() {
			return self._changes['id'] || self._map['id'];
		},

		set: function(value) {
			self._changes['id'] = value;
		}
	});

	

	Object.defineProperty(this, 'title', {
		get: function() {
			return self._changes['title'] || self._map['title'];
		},

		set: function(value) {
			self._changes['title'] = value;
		}
	});

	
	if(typeof setMap.voters != 'undefined' && setMap.voters !== null) {
		if(Array.isArray(setMap.voters)) {
			setMap.voters = setMap.voters.map(function(object) {
				return new FireModelInstanceUser(object);
			});
		}
		else {
			setMap.voters = new FireModelInstanceUser(setMap.voters);
		}
	}
	

	Object.defineProperty(this, 'voters', {
		get: function() {
			return self._changes['voters'] || self._map['voters'];
		},

		set: function(value) {
			self._changes['voters'] = value;
		}
	});

	

	Object.defineProperty(this, 'accessControl', {
		get: function() {
			return self._changes['accessControl'] || self._map['accessControl'];
		},

		set: function(value) {
			self._changes['accessControl'] = value;
		}
	});


	FireModelInstance.call(this, setMap, model, path);
}
FireModelInstanceArticle.prototype = FireModelInstance.prototype;



FireModelInstanceArticle.prototype.createVoter = function(map) {
	var self = this;
	return this._model._create(this._model.endpoint + '/' + this.id + '/voters', map)
		.then(function(otherInstance) {
			return self.refresh(otherInstance);
		});
};




function FireModelArticle($http, $q, models) {
	FireModel.call(this, $http, $q, models);

	this.endpoint = '/api/articles';
}
FireModelArticle.prototype = new FireModel();

FireModelArticle.prototype.parseResult = function(setMapOrList, path) {
	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
		var self = this;
		return setMapOrList.map(function(setMap) {
			return new FireModelInstanceArticle(setMap, self, path);
		});
	}
	else {
		return new FireModelInstanceArticle(setMapOrList, this, path);
	}
};



app.factory('ArticleModel', ['$http', '$q', 'FireModels', function($http, $q, FireModels) {
	return new FireModelArticle($http, $q, FireModels);
}]);

function FireModelInstanceArticleVoterUserVote(setMap, model, path) {
	var self = this;

	
	if(typeof setMap.userVote != 'undefined' && setMap.userVote !== null) {
		if(Array.isArray(setMap.userVote)) {
			setMap.userVote = setMap.userVote.map(function(object) {
				return new FireModelInstanceUser(object);
			});
		}
		else {
			setMap.userVote = new FireModelInstanceUser(setMap.userVote);
		}
	}
	

	Object.defineProperty(this, 'userVote', {
		get: function() {
			return self._changes['userVote'] || self._map['userVote'];
		},

		set: function(value) {
			self._changes['userVote'] = value;
		}
	});

	
	if(typeof setMap.articleVoter != 'undefined' && setMap.articleVoter !== null) {
		if(Array.isArray(setMap.articleVoter)) {
			setMap.articleVoter = setMap.articleVoter.map(function(object) {
				return new FireModelInstanceArticle(object);
			});
		}
		else {
			setMap.articleVoter = new FireModelInstanceArticle(setMap.articleVoter);
		}
	}
	

	Object.defineProperty(this, 'articleVoter', {
		get: function() {
			return self._changes['articleVoter'] || self._map['articleVoter'];
		},

		set: function(value) {
			self._changes['articleVoter'] = value;
		}
	});


	FireModelInstance.call(this, setMap, model, path);
}
FireModelInstanceArticleVoterUserVote.prototype = FireModelInstance.prototype;



function FireModelArticleVoterUserVote($http, $q, models) {
	FireModel.call(this, $http, $q, models);

	this.endpoint = '/api/articlevoteruservotes';
}
FireModelArticleVoterUserVote.prototype = new FireModel();

FireModelArticleVoterUserVote.prototype.parseResult = function(setMapOrList, path) {
	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
		var self = this;
		return setMapOrList.map(function(setMap) {
			return new FireModelInstanceArticleVoterUserVote(setMap, self, path);
		});
	}
	else {
		return new FireModelInstanceArticleVoterUserVote(setMapOrList, this, path);
	}
};



app.factory('ArticleVoterUserVoteModel', ['$http', '$q', 'FireModels', function($http, $q, FireModels) {
	return new FireModelArticleVoterUserVote($http, $q, FireModels);
}]);


// TODO: Remove this in favour of the model factories (which is more angularism).
app.service('FireModels', ['$http', '$q', function($http, $q) {
	
	this.Pet = new FireModelPet($http, $q, this);
	
	this.User = new FireModelUser($http, $q, this);
	
	this.Article = new FireModelArticle($http, $q, this);
	
	this.ArticleVoterUserVote = new FireModelArticleVoterUserVote($http, $q, this);
	
}]);
function unwrap(promise, initialValue) {
    var value = initialValue;

    promise.then(function(newValue) {
        angular.copy(newValue, value);
    });

    return value;
};


app.service('FireTestController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
    
    this.getTest = function() {
        var defer = $q.defer();

        $http['get']('/tests', {params: {}, headers: {'X-JSON-Params': true}})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    
}]);

app.service('TestControllerController', ['$http', '$q', function($http, $q) {
    
    
    this.getTest = function() {
        var defer = $q.defer();

        $http['get']('/tests', {params: {}, headers: {'X-JSON-Params': true}})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    
    
}]);

app.service('Firefn7', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn7Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn6', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn6Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn5', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn5Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn4', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn4Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn3', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn3Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn2', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn2Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn1', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn1Controller', ['$http', '$q', function($http, $q) {
    
}]);

app.service('Firefn0', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.unwrap = unwrap;
    this.models = FireModels;

    
}]);

app.service('fn0Controller', ['$http', '$q', function($http, $q) {
    
}]);


app.service('fire', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
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



    


















}]);
