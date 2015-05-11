'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('default', ['ngRoute']);


app.directive('todoEscape', [function() {
	var ESCAPE_KEY = 27;

	return function(scope, elem, attrs) {
		elem.bind('keydown', function(event) {
			if(event.keyCode === ESCAPE_KEY) {
				scope.$apply(attrs.todoEscape);
			}
		});
	};
}]);

app.directive('todoFocus', ['$timeout', function($timeout) {
	return function(scope, elem, attrs) {
		scope.$watch(attrs.todoFocus, function(newVal) {
			if(newVal) {
				$timeout(function() {
					elem[0].focus();
				}, 0, false);
			}
		});
	};
}]);

app.filter('completedFilter', ['$routeParams', function($routeParams) {
	return function(items) {
		return items.filter(function(item) {
			return ($routeParams.status == 'completed' && item.completed ||
				$routeParams.status == 'active' && !item.completed ||
				!$routeParams.status);
		});
	};
}]);



app.controller('TodoController', ['$scope', 'list', '$routeParams', 'TodoListModel', function($scope, list, $routeParams, TodoListModel) {
	$scope.status = $routeParams.status || '';
	$scope.list = list;

	console.log('Going to create:');
	TodoListModel.create([{}, {}, {}]).then(function(lists) {
		console.log('Lists:');
		console.log(lists);
	});

	$scope.completeAllItems = function() {
		var completed = true;

		if(!$scope.numberOfUncompletedItems()) {
			completed = false;
		}

		return list.updateItems({completed: !completed}, {completed: completed});
	};

	$scope.createItem = function(name) {
		name = name.trim();

		if(name.length) {
			return list.createItem({name: name}).then(function() {
				$scope.name = '';
			});
		}
	};

	$scope.deleteItem = function(item) {
		return list.removeItem(item);
	};

	$scope.toggleItem = function(item) {
		return item.save();
	};

	$scope.removeCompletedItems = function() {
		return list.removeItems({completed: true});
	};

	$scope.editItem = function(item) {
		$scope.editingItem = item;
	};

	$scope.saveItem = function(item) {
		$scope.editingItem = null;
		item.name = item.name.trim();

		if(!item.name.length) {
			return list.removeItem(item);
		}
		else {
			return item.save();
		}
	};

	$scope.cancelEditingItem = function(item) {
		$scope.editingItem = null;
		return item.cancel();
	};

	$scope.numberOfCompletedItems = function() {
		return list.items.filter(function(item) {
			return item.completed;
		}).length;
	};

	$scope.numberOfUncompletedItems = function() {
		return (list.items.length - $scope.numberOfCompletedItems());
	};
}]);

function _getUUID(modelInstanceOrUUID) {
    var UUID;

    if(typeof modelInstanceOrUUID.toQueryValue != 'undefined') {
        UUID = modelInstanceOrUUID.toQueryValue();
    }
    else if(typeof modelInstanceOrUUID == 'string') {
        UUID = modelInstanceOrUUID;
    }
    else {
        var error = new FireError('Parameter `' + modelInstanceOrUUID + '` is not a valid model instance or UUID.');
        error.status = 400;
        throw error;
    }

    return UUID;
}

function transformQueryMap(fields, options) {
    var queryMap = {};

    Object.keys(fields || {}).forEach(function(key) {
        var value = fields[key];
        if(value && typeof value.toQueryValue != 'undefined') {
            queryMap[key] = value.toQueryValue();
        }
        else {
            queryMap[key] = value;
        }
    });

    if(options) {
        queryMap.$options = options;
    }

    return queryMap;
}

function FireError(message) {
    this.name = 'FireError';
    this.message = message || '';
	this.number = -1;
}
FireError.prototype = new Error();

app.factory('FireModel', ['$http', '$q', function($http, $q) {
    return function() {
        this._prepare = function(paramsOrList) {
            var prepare = function(params) {
                var map = {};
            	Object.keys(params || {}).forEach(function(key) {
            		map[key] = JSON.stringify(params[key]);
            	});
            	return map;
            };

            if(Array.isArray(paramsOrList)) {
                return paramsOrList.map(prepare);
            }
            else {
                return prepare(paramsOrList);
            }
        };

        this._action = function(verb, path, params, data) {
        	var defer = $q.defer();

            console.log(verb + ' ' + path);
            console.log(data);

        	var self = this;
        	$http({method: verb, url: path, data: data, params: params, headers: {'x-json-params': true}})
        		.success(function(result) {
        			defer.resolve(self.parseResult(result, path));
        		})
        		.error(function(data, statusCode) {
                    var error = new FireError(data);
                    error.number = statusCode;
        			defer.reject(error);
        		});

        	return defer.promise;
        };

        this._post = function(path, fields) {
        	return this._action('post', path, null, this._prepare(fields));
        };

        this._get = function(path, params) {
        	return this._action('get', path, this._prepare(params));
        };

        this._put = function(path, fields, query) {
        	return this._action('put', path, this._prepare(query), this._prepare(fields));
        };

        this.update = function(whereMap, setMap) {
            if(typeof whereMap == 'object') {
                return this._put(this.endpoint, transformQueryMap(setMap), transformQueryMap(whereMap));
            }
            else {
                return this._put(this.endpoint + '/' + whereMap, transformQueryMap(setMap));
            }
        };

        this.remove = function(modelInstanceMapOrUUID, options) {
            var UUID = null;

            if(typeof modelInstanceMapOrUUID.toQueryValue != 'undefined') {
                UUID = modelInstanceMapOrUUID.toQueryValue();
            }
            else if(typeof modelInstanceMapOrUUID == 'string') {
                UUID = modelInstanceMapOrUUID;
            }

            if(UUID) {
                return this._action('delete', this.endpoint + '/' + UUID);
            }
            else {
                return this._action('delete', this.endpoint, this._prepare(transformQueryMap(modelInstanceMapOrUUID, options)));
            }
        };

        this.updateOrCreate = function(where, set) {
            var self = this;
            return this.update(where, set).then(function(modelInstances) {
                if(modelInstances.length) {
                    return modelInstances[0];
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

        this.findOrCreate = function(where, set) {
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

        this._create = function(path, fields) {
            if(Array.isArray(fields)) {
                return this._post(path, fields.map(function(map) {
                    return transformQueryMap(map);
                }));
            }
            else {
            	return this._post(path, transformQueryMap(fields));
            }

        };

        this.create = function(fields) {
        	return this._create(this.endpoint, fields);
        };

        this._find = function(path, fields, options) {
        	var queryMap = transformQueryMap(fields, options);
        	return this._get(path, queryMap);
        };

        this.find = function(fields, options) {
        	return this._find(this.endpoint, fields, options);
        };

        this.findOne = function(fields, options) {
        	var fieldsMap = fields || {};
        	if(fieldsMap.id) {
        		var modelID = fieldsMap.id;
        		delete fieldsMap.id;

        		var self = this;
        		return this._get(this.endpoint + '/' + modelID, transformQueryMap(fieldsMap))
        			.then(function(modelInstance) {
        				if(modelInstance) {
        					modelInstance._endpoint = self.endpoint + '/' + modelID;
        				}

        				return modelInstance;
        			});
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

        this.getOne = function(fields) {
        	var defer = $q.defer();
        	this.findOne(fields)
        		.then(function(model) {
        			if(model) {
        				defer.resolve(model);
        			}
        			else {
        				var error = new FireError('Not Found');
        				error.number = 404;
        				defer.reject(error);
        			}
        		});
        	return defer.promise;
        };
    };
}]);


app.factory('TodoItemModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/todo-items';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoItem');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceTodoItem', ['TodoItemModel', '$q', '$http', '$injector', function(TodoItemModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTodoItem only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.list != 'undefined' && setMap.list !== null) {
    		if(Array.isArray(setMap.list)) {
    			setMap.list = setMap.list.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoList');
                    return new fireModelInstanceConstructor(object, path + '/' + 'lists');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoList');
    			setMap.list = new fireModelInstanceConstructor(setMap.list, path + '/' + 'lists');
    		}
    	}
    	

    	Object.defineProperty(this, 'list', {
    		get: function() {
    			if(typeof self._changes['list'] != 'undefined') {
    				return self._changes['list'];
    			}

    			return self._map['list'];
    		},

    		set: function(value) {
    			self._changes['list'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes['name'] != 'undefined') {
    				return self._changes['name'];
    			}

    			return self._map['name'];
    		},

    		set: function(value) {
    			self._changes['name'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'completed', {
    		get: function() {
    			if(typeof self._changes['completed'] != 'undefined') {
    				return self._changes['completed'];
    			}

    			return self._map['completed'];
    		},

    		set: function(value) {
    			self._changes['completed'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'createdAt', {
    		get: function() {
    			if(typeof self._changes['createdAt'] != 'undefined') {
    				return self._changes['createdAt'];
    			}

    			return self._map['createdAt'];
    		},

    		set: function(value) {
    			self._changes['createdAt'] = value;
    		}
    	});
    

    
        
    
        
    
        
    
        
    
        
        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TodoItemModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TodoItemModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTodoItem._model is deprecated.');
            }
        });

        

        
        
        this.getList = function(queryMap, optionsMap) {
            var self = this;
            return $injector.get('TodoListModel')._find(TodoItemModel.endpoint + '/' + this.id + '/list', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TodoListModel').endpoint + '/' + modelInstance.id;
        				}

                        self.list = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createList = function(queryMap) {
            var self = this;
            return $injector.get('TodoListModel')._create(TodoItemModel.endpoint + '/' + this.id + '/list', queryMap)
                .then(function(modelInstance) {
                    self.list = modelInstance;
                    return modelInstance;
                });
        };

        this.removeList = function() {
            var self = this;
            return $injector.get('TodoListModel')._action('delete', TodoItemModel.endpoint + '/' + this.id + '/list')
                .then(function(removeModelInstance) {
                    self.list = null;
                    return removeModelInstance;
                });
        };
        
        
        
        
    };
}]);

app.factory('TodoListModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/todo-lists';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoList');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    
    model.getCurrentList = function() {
        var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

        return (function(){
		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')});
		}
		else {
			return TodoListModel.create({}).then(function(list) {
				_StorageService.set('list', list.id);
				return list;
			});
		}
	})();
    };
    

    return model;
}]);

app.factory('FireModelInstanceTodoList', ['TodoListModel', '$q', '$http', '$injector', function(TodoListModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTodoList only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.items != 'undefined' && setMap.items !== null) {
    		if(Array.isArray(setMap.items)) {
    			setMap.items = setMap.items.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoItem');
                    return new fireModelInstanceConstructor(object, path + '/' + 'items');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoItem');
    			setMap.items = new fireModelInstanceConstructor(setMap.items, path + '/' + 'items');
    		}
    	}
    	

    	Object.defineProperty(this, 'items', {
    		get: function() {
    			if(typeof self._changes['items'] != 'undefined') {
    				return self._changes['items'];
    			}

    			return self._map['items'];
    		},

    		set: function(value) {
    			self._changes['items'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'createdAt', {
    		get: function() {
    			if(typeof self._changes['createdAt'] != 'undefined') {
    				return self._changes['createdAt'];
    			}

    			return self._map['createdAt'];
    		},

    		set: function(value) {
    			self._changes['createdAt'] = value;
    		}
    	});
    

    
        
    
        
    
        
        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TodoListModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TodoListModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTodoList._model is deprecated.');
            }
        });

        
        this.getCurrentList = function() {
            var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

            return (function(){
		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')});
		}
		else {
			return TodoListModel.create({}).then(function(list) {
				_StorageService.set('list', list.id);
				return list;
			});
		}
	})();
        };
        

        
        
        
        this.getItems = function(queryMap, optionsMap) {
            var self = this;
        	return $injector.get('TodoItemModel')._find(TodoListModel.endpoint + '/' + this.id + '/items', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.items = modelInstances;
                    return modelInstances;
                })
        };

        this.createItem = function(queryMap) {
            var self = this;
            return $injector.get('TodoItemModel')._create(TodoListModel.endpoint + '/' + this.id + '/items', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.items) {
                        self.items = [];
                    }

                    // TODO: How should we sort these associations?
                    self.items.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.removeItem = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            var self = this;
            return $injector.get('TodoItemModel')._action('delete', TodoListModel.endpoint + '/' + this.id + '/items/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.items.length; i < il; i++) {
                        var modelInstance = self.items[i];

                        if(modelInstance.id === UUID) {
                            self.items.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.removeItems = function(map) {
            var self = this;
            return $injector.get('TodoItemModel')._action('delete', TodoListModel.endpoint + '/' + this.id + '/items', TodoListModel._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.items = self.items.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.updateItems = function(where, set) {
            var self = this;
            return $injector.get('TodoItemModel')._put(TodoListModel.endpoint + '/' + this.id + '/items', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.items.length; j < jl; j++) {
                            var modelInstance = self.items[j];

                            if(modelInstance.id == updatedModelInstance.id) {
                                Object.keys(updatedModelInstance._map).forEach(function(key) {
                                    if(updatedModelInstance._map[key] !== null) {
                                        modelInstance._map[key] = updatedModelInstance._map[key];
                                    }
                                });
                                break;
                            }
                        }
                    }
                });
        };

        
        
        
    };
}]);

app.factory('TestModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/tests';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceTest', ['TestModel', '$q', '$http', '$injector', function(TestModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTest only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes['name'] != 'undefined') {
    				return self._changes['name'];
    			}

    			return self._map['name'];
    		},

    		set: function(value) {
    			self._changes['name'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.sessions != 'undefined' && setMap.sessions !== null) {
    		if(Array.isArray(setMap.sessions)) {
    			setMap.sessions = setMap.sessions.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                    return new fireModelInstanceConstructor(object, path + '/' + 'sessions');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
    			setMap.sessions = new fireModelInstanceConstructor(setMap.sessions, path + '/' + 'sessions');
    		}
    	}
    	

    	Object.defineProperty(this, 'sessions', {
    		get: function() {
    			if(typeof self._changes['sessions'] != 'undefined') {
    				return self._changes['sessions'];
    			}

    			return self._map['sessions'];
    		},

    		set: function(value) {
    			self._changes['sessions'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.variants != 'undefined' && setMap.variants !== null) {
    		if(Array.isArray(setMap.variants)) {
    			setMap.variants = setMap.variants.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestVariant');
                    return new fireModelInstanceConstructor(object, path + '/' + 'variants');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestVariant');
    			setMap.variants = new fireModelInstanceConstructor(setMap.variants, path + '/' + 'variants');
    		}
    	}
    	

    	Object.defineProperty(this, 'variants', {
    		get: function() {
    			if(typeof self._changes['variants'] != 'undefined') {
    				return self._changes['variants'];
    			}

    			return self._map['variants'];
    		},

    		set: function(value) {
    			self._changes['variants'] = value;
    		}
    	});
    

    
        
    
        
    
        
    
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TestModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTest._model is deprecated.');
            }
        });

        

        
        
        
        this.getSessions = function(queryMap, optionsMap) {
            var self = this;
        	return $injector.get('TestSessionModel')._find(TestModel.endpoint + '/' + this.id + '/sessions', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.sessions = modelInstances;
                    return modelInstances;
                })
        };

        this.createSession = function(queryMap) {
            var self = this;
            return $injector.get('TestSessionModel')._create(TestModel.endpoint + '/' + this.id + '/sessions', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.sessions) {
                        self.sessions = [];
                    }

                    // TODO: How should we sort these associations?
                    self.sessions.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.removeSession = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            var self = this;
            return $injector.get('TestSessionModel')._action('delete', TestModel.endpoint + '/' + this.id + '/sessions/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.sessions.length; i < il; i++) {
                        var modelInstance = self.sessions[i];

                        if(modelInstance.id === UUID) {
                            self.sessions.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.removeSessions = function(map) {
            var self = this;
            return $injector.get('TestSessionModel')._action('delete', TestModel.endpoint + '/' + this.id + '/sessions', TestModel._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.sessions = self.sessions.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.updateSessions = function(where, set) {
            var self = this;
            return $injector.get('TestSessionModel')._put(TestModel.endpoint + '/' + this.id + '/sessions', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.sessions.length; j < jl; j++) {
                            var modelInstance = self.sessions[j];

                            if(modelInstance.id == updatedModelInstance.id) {
                                Object.keys(updatedModelInstance._map).forEach(function(key) {
                                    if(updatedModelInstance._map[key] !== null) {
                                        modelInstance._map[key] = updatedModelInstance._map[key];
                                    }
                                });
                                break;
                            }
                        }
                    }
                });
        };

        
        
        
        
        
        this.getVariants = function(queryMap, optionsMap) {
            var self = this;
        	return $injector.get('TestVariantModel')._find(TestModel.endpoint + '/' + this.id + '/variants', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.variants = modelInstances;
                    return modelInstances;
                })
        };

        this.createVariant = function(queryMap) {
            var self = this;
            return $injector.get('TestVariantModel')._create(TestModel.endpoint + '/' + this.id + '/variants', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.variants) {
                        self.variants = [];
                    }

                    // TODO: How should we sort these associations?
                    self.variants.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.removeVariant = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            var self = this;
            return $injector.get('TestVariantModel')._action('delete', TestModel.endpoint + '/' + this.id + '/variants/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.variants.length; i < il; i++) {
                        var modelInstance = self.variants[i];

                        if(modelInstance.id === UUID) {
                            self.variants.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.removeVariants = function(map) {
            var self = this;
            return $injector.get('TestVariantModel')._action('delete', TestModel.endpoint + '/' + this.id + '/variants', TestModel._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.variants = self.variants.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.updateVariants = function(where, set) {
            var self = this;
            return $injector.get('TestVariantModel')._put(TestModel.endpoint + '/' + this.id + '/variants', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.variants.length; j < jl; j++) {
                            var modelInstance = self.variants[j];

                            if(modelInstance.id == updatedModelInstance.id) {
                                Object.keys(updatedModelInstance._map).forEach(function(key) {
                                    if(updatedModelInstance._map[key] !== null) {
                                        modelInstance._map[key] = updatedModelInstance._map[key];
                                    }
                                });
                                break;
                            }
                        }
                    }
                });
        };

        
        
        
    };
}]);

app.factory('TestParticipantModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/test-participants';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceTestParticipant', ['TestParticipantModel', '$q', '$http', '$injector', function(TestParticipantModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestParticipant only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.sessions != 'undefined' && setMap.sessions !== null) {
    		if(Array.isArray(setMap.sessions)) {
    			setMap.sessions = setMap.sessions.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                    return new fireModelInstanceConstructor(object, path + '/' + 'sessions');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
    			setMap.sessions = new fireModelInstanceConstructor(setMap.sessions, path + '/' + 'sessions');
    		}
    	}
    	

    	Object.defineProperty(this, 'sessions', {
    		get: function() {
    			if(typeof self._changes['sessions'] != 'undefined') {
    				return self._changes['sessions'];
    			}

    			return self._map['sessions'];
    		},

    		set: function(value) {
    			self._changes['sessions'] = value;
    		}
    	});
    

    
        
    
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestParticipantModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TestParticipantModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTestParticipant._model is deprecated.');
            }
        });

        

        
        
        
        this.getSessions = function(queryMap, optionsMap) {
            var self = this;
        	return $injector.get('TestSessionModel')._find(TestParticipantModel.endpoint + '/' + this.id + '/sessions', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.sessions = modelInstances;
                    return modelInstances;
                })
        };

        this.createSession = function(queryMap) {
            var self = this;
            return $injector.get('TestSessionModel')._create(TestParticipantModel.endpoint + '/' + this.id + '/sessions', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.sessions) {
                        self.sessions = [];
                    }

                    // TODO: How should we sort these associations?
                    self.sessions.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.removeSession = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            var self = this;
            return $injector.get('TestSessionModel')._action('delete', TestParticipantModel.endpoint + '/' + this.id + '/sessions/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.sessions.length; i < il; i++) {
                        var modelInstance = self.sessions[i];

                        if(modelInstance.id === UUID) {
                            self.sessions.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.removeSessions = function(map) {
            var self = this;
            return $injector.get('TestSessionModel')._action('delete', TestParticipantModel.endpoint + '/' + this.id + '/sessions', TestParticipantModel._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.sessions = self.sessions.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.updateSessions = function(where, set) {
            var self = this;
            return $injector.get('TestSessionModel')._put(TestParticipantModel.endpoint + '/' + this.id + '/sessions', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.sessions.length; j < jl; j++) {
                            var modelInstance = self.sessions[j];

                            if(modelInstance.id == updatedModelInstance.id) {
                                Object.keys(updatedModelInstance._map).forEach(function(key) {
                                    if(updatedModelInstance._map[key] !== null) {
                                        modelInstance._map[key] = updatedModelInstance._map[key];
                                    }
                                });
                                break;
                            }
                        }
                    }
                });
        };

        
        
        
    };
}]);

app.factory('TestSessionModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/test-sessions';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceTestSession', ['TestSessionModel', '$q', '$http', '$injector', function(TestSessionModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestSession only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.test != 'undefined' && setMap.test !== null) {
    		if(Array.isArray(setMap.test)) {
    			setMap.test = setMap.test.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
                    return new fireModelInstanceConstructor(object, path + '/' + 'tests');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
    			setMap.test = new fireModelInstanceConstructor(setMap.test, path + '/' + 'tests');
    		}
    	}
    	

    	Object.defineProperty(this, 'test', {
    		get: function() {
    			if(typeof self._changes['test'] != 'undefined') {
    				return self._changes['test'];
    			}

    			return self._map['test'];
    		},

    		set: function(value) {
    			self._changes['test'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.participant != 'undefined' && setMap.participant !== null) {
    		if(Array.isArray(setMap.participant)) {
    			setMap.participant = setMap.participant.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
                    return new fireModelInstanceConstructor(object, path + '/' + 'participants');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
    			setMap.participant = new fireModelInstanceConstructor(setMap.participant, path + '/' + 'participants');
    		}
    	}
    	

    	Object.defineProperty(this, 'participant', {
    		get: function() {
    			if(typeof self._changes['participant'] != 'undefined') {
    				return self._changes['participant'];
    			}

    			return self._map['participant'];
    		},

    		set: function(value) {
    			self._changes['participant'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'variant', {
    		get: function() {
    			if(typeof self._changes['variant'] != 'undefined') {
    				return self._changes['variant'];
    			}

    			return self._map['variant'];
    		},

    		set: function(value) {
    			self._changes['variant'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'createdAt', {
    		get: function() {
    			if(typeof self._changes['createdAt'] != 'undefined') {
    				return self._changes['createdAt'];
    			}

    			return self._map['createdAt'];
    		},

    		set: function(value) {
    			self._changes['createdAt'] = value;
    		}
    	});
    

    
        
    
        
    
        
    
        
    
        
        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestSessionModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TestSessionModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTestSession._model is deprecated.');
            }
        });

        

        
        
        this.getTest = function(queryMap, optionsMap) {
            var self = this;
            return $injector.get('TestModel')._find(TestSessionModel.endpoint + '/' + this.id + '/test', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestModel').endpoint + '/' + modelInstance.id;
        				}

                        self.test = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createTest = function(queryMap) {
            var self = this;
            return $injector.get('TestModel')._create(TestSessionModel.endpoint + '/' + this.id + '/test', queryMap)
                .then(function(modelInstance) {
                    self.test = modelInstance;
                    return modelInstance;
                });
        };

        this.removeTest = function() {
            var self = this;
            return $injector.get('TestModel')._action('delete', TestSessionModel.endpoint + '/' + this.id + '/test')
                .then(function(removeModelInstance) {
                    self.test = null;
                    return removeModelInstance;
                });
        };
        
        
        
        
        
        this.getParticipant = function(queryMap, optionsMap) {
            var self = this;
            return $injector.get('TestParticipantModel')._find(TestSessionModel.endpoint + '/' + this.id + '/participant', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestParticipantModel').endpoint + '/' + modelInstance.id;
        				}

                        self.participant = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createParticipant = function(queryMap) {
            var self = this;
            return $injector.get('TestParticipantModel')._create(TestSessionModel.endpoint + '/' + this.id + '/participant', queryMap)
                .then(function(modelInstance) {
                    self.participant = modelInstance;
                    return modelInstance;
                });
        };

        this.removeParticipant = function() {
            var self = this;
            return $injector.get('TestParticipantModel')._action('delete', TestSessionModel.endpoint + '/' + this.id + '/participant')
                .then(function(removeModelInstance) {
                    self.participant = null;
                    return removeModelInstance;
                });
        };
        
        
        
        
    };
}]);

app.factory('TestVariantModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/test-variants';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestVariant');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceTestVariant', ['TestVariantModel', '$q', '$http', '$injector', function(TestVariantModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestVariant only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes['name'] != 'undefined') {
    				return self._changes['name'];
    			}

    			return self._map['name'];
    		},

    		set: function(value) {
    			self._changes['name'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'numberOfParticipants', {
    		get: function() {
    			if(typeof self._changes['numberOfParticipants'] != 'undefined') {
    				return self._changes['numberOfParticipants'];
    			}

    			return self._map['numberOfParticipants'];
    		},

    		set: function(value) {
    			self._changes['numberOfParticipants'] = value;
    		}
    	});
    
    	
    	if(typeof setMap.test != 'undefined' && setMap.test !== null) {
    		if(Array.isArray(setMap.test)) {
    			setMap.test = setMap.test.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
                    return new fireModelInstanceConstructor(object, path + '/' + 'tests');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
    			setMap.test = new fireModelInstanceConstructor(setMap.test, path + '/' + 'tests');
    		}
    	}
    	

    	Object.defineProperty(this, 'test', {
    		get: function() {
    			if(typeof self._changes['test'] != 'undefined') {
    				return self._changes['test'];
    			}

    			return self._map['test'];
    		},

    		set: function(value) {
    			self._changes['test'] = value;
    		}
    	});
    

    
        
    
        
    
        
    
        
    

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestVariantModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return TestVariantModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceTestVariant._model is deprecated.');
            }
        });

        

        
        
        this.getTest = function(queryMap, optionsMap) {
            var self = this;
            return $injector.get('TestModel')._find(TestVariantModel.endpoint + '/' + this.id + '/test', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestModel').endpoint + '/' + modelInstance.id;
        				}

                        self.test = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createTest = function(queryMap) {
            var self = this;
            return $injector.get('TestModel')._create(TestVariantModel.endpoint + '/' + this.id + '/test', queryMap)
                .then(function(modelInstance) {
                    self.test = modelInstance;
                    return modelInstance;
                });
        };

        this.removeTest = function() {
            var self = this;
            return $injector.get('TestModel')._action('delete', TestVariantModel.endpoint + '/' + this.id + '/test')
                .then(function(removeModelInstance) {
                    self.test = null;
                    return removeModelInstance;
                });
        };
        
        
        
        
    };
}]);


app.service('FireModels', [function() {
    throw new Error('FireModels service is deprecated.');
}]);
function unwrap(promise, initialValue) {
    var value = initialValue;

    promise.then(function(newValue) {
        angular.copy(newValue, value);
    });

    return value;
};

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

    this.isServer = function() {
        return false;
    };

    this.isClient = function() {
        return true;
    };
}]);

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });


    $routeProvider.when('/', {
        templateUrl: '/templates/todo.html',
        controller: 'TodoController',
        resolve: {
        
        
            list: ['TodoListModel', function(TodoListModel) {
			return TodoListModel.getCurrentList(123);
		}],
        
        }
    });

    $routeProvider.when('/:status', {
        templateUrl: '/templates/todo.html',
        controller: 'TodoController',
        resolve: {
        
        
            list: ['TodoListModel', function(TodoListModel) {
			return TodoListModel.getCurrentList(123);
		}],
        
        }
    });


}]);
app.service('ChannelService', ['WebSocketService', '$rootScope', function(WebSocketService, $rootScope) {
	var channelsMap = {};

	function getChannelAddress(channelId, channelType) {
		return (channelType + ':' + channelId);
	}

	this.registerChannel = function(channel) {
		channelsMap[getChannelAddress(channel.id, channel.type)] = channel;

		this.sendMessageOnChannel({
			event: '_subscribe'
		}, channel);
	};

	this.getChannel = function(channelId, channelType) {
		return channelsMap[getChannelAddress(channelId, channelType)];
	};

	this.getUnknownMessage = function(messageMap, channelMap) { //jshint ignore:line
		console.log('Unknown message.');
	};

	this.sendMessageOnChannel = function(message, channel) {
		return WebSocketService.send({
			channel: {
				type: channel.type,
				id: channel.id
			},
			message: message
		});
	};

	var self = this;
	WebSocketService.parsePacket = function(packet) {
		var channel = self.getChannel(packet.channel.id, packet.channel.type);
		if(channel) {
			if(channel.delegate) {
				$rootScope.$apply(function() {
					channel.delegate(packet.message);
				});
			}
			else {
				console.log('Warning: no delegate set on channel.');
			}
		}
		else {
			$rootScope.$apply(function() {
				self.getUnknownMessage(packet.message, packet.channel);
			});
		}
	};
}]);

app.service('WebSocketService', ['$location', '$timeout', function($location, $timeout) {
	var queue = [];

	var reconnectInterval = 1000;
	var reconnectDecay = 1.5;
	var reconnectAttempts = 0;
	var reconnectMaximum = 60 * 1000;
	var socket = null;

	var self = this;
	var onOpen = function () {
		if(queue && queue.length > 0) {
			var queue_ = queue;
			queue = null;

			queue_.forEach(function(message) {
				self.send(message);
			});
		}
	};

	var onError = function(error) {
		console.log('error');
		console.log(error);
	};

	var onClose = function(event) {
		$timeout(connect, Math.max(reconnectMaximum, reconnectInterval * Math.pow(reconnectDecay, reconnectAttempts)));
	};

	var onMessage = function(event) {
		var packet = JSON.parse(event.data);

		// TODO: Change this to an event emitter instead. Now it's only possible to delegate the packets to 1 listeners.

		if(self.parsePacket) {
			self.parsePacket(packet);
		}
	};

	function connect() {
		reconnectAttempts++;

		socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
		socket.onopen = onOpen;
		socket.onerror = onError;
		socket.onclose = onClose;
		socket.onmessage = onMessage;
	}

	this.send = function(message) {
		if(queue !== null) {
			queue.push(message);
		}
		else {
			console.log(socket);

			socket.send(JSON.stringify(message));
		}
	};
	this.parsePacket = null;

	connect();
}]);


/* global window, app */
app.service('_StorageService', [function _StorageService() {
	var storage = {};

	this.get = function(key) {
		if(typeof storage[key] != 'undefined') {
			return storage[key];
		}
		else {
			return window.localStorage.getItem(key);
		}
	};

	this.set = function(key, value) {
		try {
			window.localStorage.setItem(key, value);
		}
		catch(error) {
			storage[key] = value;
		}
	};

	this.unset = function(key) {
		if(typeof storage[key] != 'undefined') {
			delete storage[key];
		}
		else {
			window.localStorage.removeItem(key);
		}
	};
}]);

app.provider('TestsService', [function() {
	var _delegate = null;
	this.delegate = function(delegate) {
		_delegate = delegate;
	};

	this.$get = function() {
		return {
			participate: function(test, variant) {
				if(_delegate === null) {
					throw new Error('Please set the TestsService.delegate');
				}
				else if(typeof _delegate != 'function') {
					throw new Error('TestsService#delegate must be a function.');
				}
				else {
					_delegate(test, variant);
				}
			}
		};
	}
}]);


