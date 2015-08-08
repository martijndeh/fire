var angular = require('angular');
var app = angular.module('todomvc', [require('angular-route')]);


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



app.controller('TodoController', ['$scope', 'list', '$routeParams', function($scope, list, $routeParams) {
	$scope.status = $routeParams.status || '';
	$scope.list = list;

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
			return list
				.createItem({name: name})
				.then(function() {
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

app.factory('FireUUID', function() {
    return function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    };
});

app.factory('_djb2Hash', function() {
    return function _djb2Hash(str){
        var hash = 5381;
        var char = 0;
        for(var i = 0, il = str.length; i < il; i++) {
            char = str.charCodeAt(i);
            hash = hash * 33 + char;
        }
        return (Math.abs(hash) % (Math.pow(2, 52) - 1));
    };
});

app.service('_CacheService', ['$injector', function($injector) {
    var CAPACITY = 25;
    var LOCAL_STORAGE_KEY = '_CacheService';
    var objects = {};
    var keys = [];
    var indices = {};

    this.numberOfCaches = function() {
        return keys.length;
    };

    if(window.localStorage) {
        var item = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if(item) {
            try {
                var data = JSON.parse(item);
                if(data && data.objects && data.keys && data.indices) {
                    objects = data.objects;
                    keys = data.keys;
                    indices = data.indices;
                }
            }
            catch(e) {
                window.localStorage.setItem(LOCAL_STORAGE_KEY, null);
            }
        }
    }

    function persist() {
        if(window.localStorage) {
            try {
                window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                    objects: objects,
                    keys: keys,
                    indices: indices
                }));
            }
            catch(e) {
                //
            }
        }
    }

    function refreshKey(key) {
        keys.splice(keys.indexOf(key), 1);
        keys.push(key);
    }

    function getKeys(key) {
        var indexOfDot = key.indexOf('.');
        if(indexOfDot != -1) {
            var stringBeforeDot = key.substring(0, indexOfDot);
            var stringAfterDot = key.substring(indexOfDot + 1);

            return [stringBeforeDot, stringAfterDot];
        }

        return [];
    }

    function index(key) {
        var strings = getKeys(key);

        if(strings.length) {
            var stringBeforeDot = strings[0];
            var stringAfterDot = strings[1];

            if(typeof indices[stringBeforeDot] != 'undefined') {
                if(indices[stringBeforeDot].indexOf(stringAfterDot) == -1) {
                    indices[stringBeforeDot].push(stringAfterDot);
                    return true;
                }
            }
            else {
                indices[stringBeforeDot] = [
                    stringAfterDot
                ];
                return true;
            }
        }

        return false;
    }

    function unindex(key) {
        var strings = getKeys(key);

        if(strings.length) {
            var stringBeforeDot = strings[0];
            var stringAfterDot = strings[1];

            if(typeof indices[stringBeforeDot] != 'undefined') {
                if(stringAfterDot == '*') {
                    indices[stringBeforeDot].forEach(function(oldKey) {
                        var completeKey = stringBeforeDot + '.' + oldKey;
                        delete objects[completeKey];

                        var indexOfCompleteKey = keys.indexOf(completeKey);
                        if(indexOfCompleteKey != -1) {
                            keys.splice(indexOfCompleteKey, 1);
                        }
                    });
                    delete indices[stringBeforeDot];
                    return true;
                }
                else {
                    var indexOfKey = indices[stringBeforeDot].indexOf(stringAfterDot);
                    if(indexOfKey != -1) {
                        indices[stringBeforeDot].splice(indexOfKey, 1);
                    }
                }
            }
        }

        return false;
    }

    this.remove = function(key) {
        if(!unindex(key)) {
            if(typeof objects[key] != 'undefined') {
                delete objects[key];
                keys.splice(keys.indexOf(key), 1);
            }
        }
    };

    this.removeAll = function() {
        objects = {};
        keys = [];
        indices = {};

        persist();
    };

    this.get = function(key, expire) {
        var object = objects[key];
        if(typeof objects[key] != 'undefined' && (typeof expire == 'undefined' || expire == -1 || (new Date().getTime() - object.time) < expire)) {
            refreshKey(key);

            if(object.value && object.value._map && object.value._map._type) {
				var fireModelInstanceConstructor = $injector.get('FireModelInstance' + object.value._map._type);
				object.value = new fireModelInstanceConstructor(object.value._map, object.value._path);
			}

            return object.value;
        }

        return null;
    };

    this.put = function(key, value, expire) {
        if(typeof expire != 'undefined' && (expire == -1 || expire > 0)) {
            if(keys.length > CAPACITY) {
                var oldKeys = keys.splice(0, keys.length - CAPACITY);
                oldKeys.forEach(function(oldKey) {
                    unindex(oldKey);
                    objects[oldKey] = null;
                });
            }

            if(index(key)) {
                keys.push(key);
            }

            objects[key] = {
                value: value,
                time: new Date().getTime()
            };

            persist();
        }
    };

    this.persist = function() {
        persist();
    };
}]);

app.service('FireSocketService', ['$location', '$rootScope', function($location, $rootScope) {
    var socket = null;
    var queue = [];

    var reconnectInterval = 1000;
	var reconnectDecay = 1.5;
	var connectAttempts = 0;
	var reconnectMaximum = 60 * 1000;
    var delegates = [];

    var self = this;
    function onOpen() {
        if(queue && queue.length > 0) {
			var queue_ = queue;
			queue = null;

			queue_.forEach(function(messageMap) {
				self.send(messageMap);
			});
		}
    }

    function onError(error) {
        //
    }

    function onClose() {
        // TODO: Check if we want to reconnect?

        socket = null;
        if(queue === null) {
            queue = [];
        }

        //$timeout(connect, Math.max(reconnectMaximum, reconnectInterval * Math.pow(reconnectDecay, connectAttempts)));
    }

    function onMessage(event) {
        try {
            var messageMap = JSON.parse(event.data);
            delegates.forEach(function(delegate) {
                $rootScope.$apply(function() {
                    delegate(messageMap);
                });
            });
        }
        catch(e) {
            //
        }
    }

    function connect() {
        connectAttempts++;

        socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
        socket.onopen = onOpen;
        socket.onerror = onError;
        socket.onclose = onClose;
        socket.onmessage = onMessage;
    }

    this.isConnected = function() {
        return (socket !== null && queue === null);
    };

    this.close = function() {
        if(socket) {
            socket.close();
            socket = null;
            queue = [];
        }
    };

    this.send = function(messageMap) {
        if(!socket) {
            connect();
        }

        if(queue !== null) {
			queue.push(messageMap);
		}
		else {
			socket.send(JSON.stringify(messageMap));
		}
    }

    this.delegate = function(delegate) {
        delegates.push(delegate);

        return function() {
            var index = delegates.indexOf(delegate);
            if(index != -1) {
                delegates.splice(index, 1);
            }
        };
    }
}]);

app.service('FireStreamService', ['FireSocketService', 'FireUUID', function(FireSocketService, FireUUID) {
    var streams = {};
    function parseMessage(messageMap) {
        if(messageMap.msg == 'added') {
            var stream = streams[messageMap.id];
            if(stream) {
                var modelInstances = stream._model.parseResult(messageMap.result);
                stream.results = stream.results.concat(modelInstances);

                if(stream.isLoading) {
                    stream.isLoading = false;
                }
            }
        }
        else if(messageMap.msg == 'changed') {
            //
        }
        else if(messageMap.msg == 'removed') {
            //
        }
        else if(messageMap.msg == 'nosub') {
            var stream = streams[messageMap.id];
            if(stream) {
                stream.error = messageMap.error;

                if(stream.isLoading) {
                    stream.isLoading = false;
                }

                stream.close();
            }
        }
    }
    var close = null;

    this.open = function(model, whereMap, optionsMap) {
        if(close === null) {
            close = FireSocketService.delegate(parseMessage);
        }

        var stream = {
            id: FireUUID(),
            isLoading: true,
            results: [],
            _model: model,
            close: function() {
                if(typeof streams[stream.id] != 'undefined') {
                    FireSocketService.send({
                        msg: 'unsub',
                        id: stream.id
                    });

                    delete streams[stream.id];

                    if(Object.keys(streams).length === 0) {
                        close();

                        close = null;
                    }
                }
            },
            error: null
        };
        streams[stream.id] = stream;

        FireSocketService.send({
            msg: 'sub',
            id: stream.id,
            name: model.name,
            params: [whereMap || {}, optionsMap || {}]
        });

        return stream;
    };
}]);

app.factory('FireModel', ['$http', '$q', '$injector', '_CacheService', '_djb2Hash', 'FireStreamService', function($http, $q, $injector, _CacheService, _djb2Hash, FireStreamService) {
    return function FireModel(name, autoFetchedAssociationNames, endpoint) {
        this.name = name;
        this.autoFetchedAssociationNames = autoFetchedAssociationNames;
        this.endpoint = endpoint;

        var self = this;
        this.parse = function(parseMap) {
            return this.parseResult(parseMap, null);
        };

        this.purge = function() {
            if(_CacheService.numberOfCaches() > 0) {
                var purgedModelNames = [];

                var purge = function(modelName) {
                    if(purgedModelNames.indexOf(modelName) == -1) {
                        purgedModelNames.push(modelName);

                        var model = $injector.get(modelName + 'Model');

                        _CacheService.remove(model.name + '.*', false);
                        model.autoFetchedAssociationNames.forEach(function(associatedModelName) {
                            purge(associatedModelName);
                        });
                    }
                };

                purge(this.name);
                _CacheService.persist();
            }
        };

        this.new = function() {
            var fireModelInstanceConstructor = $injector.get('FireModelInstance' + this.name);
            return new fireModelInstanceConstructor(null, this.endpoint);
        };

        this.parseResult = function(setMapOrList, path) {
            function parseSetMap(setMap) {
                var fireModelInstanceConstructor;
                if(setMap._type) {
                    fireModelInstanceConstructor = $injector.get('FireModelInstance' + setMap._type);
                }
                else {
                    fireModelInstanceConstructor = $injector.get('FireModelInstance' + self.name);
                }

                return new fireModelInstanceConstructor(setMap, path);
            }

        	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
        		return setMapOrList.map(parseSetMap);
        	}
            else if(typeof setMapOrList == 'string') {
                return setMapOrList;
            }
        	else {
        		return parseSetMap(setMapOrList);
        	}
        };

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

            $http({method: verb, url: path, data: data, params: params, headers: {'x-json-params': true, 'Content-Type': 'application/json;charset=utf-8'}})
        		.success(function(result) {
                    if(verb != 'get') {
                        self.purge();
                    }

                    defer.resolve(self.parseResult(result, path));
        		})
        		.error(function(errorData, statusCode) {
                    var error = new FireError(errorData);
                    error.number = statusCode;
        			defer.reject(error);
        		});

        	return defer.promise;
        };

        this._delete = function(path, fields) {
        	return this._action('delete', path, null, this._prepare(fields));
        };

        this._post = function(path, fields) {
        	return this._action('post', path, null, this._prepare(fields));
        };

        this._get = function(path, params) {
            var key = this.name + '.' + _djb2Hash(path + ((Object.keys(params || {}).length > 0) ? JSON.stringify(params) : ''));
            var data = _CacheService.get(key, params.$options && params.$options.cache);
            if(data && (!params.$options || typeof params.$options.returnCache == 'undefined' || params.$options.returnCache)) {
                if(params.$options && params.$options.autoReload) {
                    params.$options.returnCache = false;
                    delete params.$options.autoReload;

                    this._get(path, params)
                        .then(function(result) {
                            if(Array.isArray(data)) {
                                // TODO: What if result contains more items than data?
                                data.forEach(function(modelInstance, index) {
                                    if(index < result.length) {
                                        modelInstance.refresh(result[index]);
                                    }
                                    else {
                                        // TODO: data contains more items than result. So a couple of items were removed. Now what?
                                    }
                                });
                            }
                            else {
                                data.refresh(result);
                            }
                        });
                }

                return $q.when(data);
            }
            else {
            	return this._action('get', path, this._prepare(params))
                    .then(function(result) {
                        _CacheService.put(key, result, params.$options && params.$options.cache);
                        return result;
                    });
            }
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

        this.stream = function(whereMap, optionsMap) {
            return FireStreamService.open(this, whereMap, optionsMap);
        };

        this._find = function(path, fields, options) {
        	var queryMap = transformQueryMap(fields, options);
        	return this._get(path, queryMap);
        };

        this.exists = function(whereMap) {
            return this.count(whereMap)
                .then(function(count) {
                    return (count > 0);
                });
        };

        this.count = function(propertyName_, whereMap_) {
            var propertyName = null;
            var whereMap = null;

            if(propertyName_ && typeof propertyName_ == 'object') {
        		whereMap = propertyName_;
        	}
        	else {
        		propertyName = propertyName_;
        		whereMap = whereMap_ || {};
        	}

            return this._find(this.endpoint + '/_count', whereMap, {propertyName: propertyName})
                .then(function(result) {
                    return parseInt(result);
                });
        };

        this.search = function(searchText, fields, options) {
            var queryMap = transformQueryMap(fields, options);
            queryMap._search = searchText;
            return this._action('search', this.endpoint, this._prepare(queryMap));
        };

        this.find = function(fields, options) {
        	return this._find(this.endpoint, fields, options);
        };

        this.findOne = function(fields, options) {
        	var fieldsMap = fields || {};
        	if(fieldsMap.id) {
        		var modelID = fieldsMap.id;
        		delete fieldsMap.id;

        		return this._get(this.endpoint + '/' + modelID, transformQueryMap(fieldsMap, options))
        			.then(function(modelInstance) {
        				if(modelInstance) {
        					modelInstance._endpoint = self.endpoint + '/' + modelID;
        				}

        				return modelInstance;
        			})
                    .catch(function() {
                        return null;
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

app.service('FireModelInstance', ['$injector', '$q', function($injector, $q) {
    this.construct = function(modelInstance, setMap, path, model) {
        modelInstance._model = model;
        modelInstance._path = path;
        modelInstance._map = setMap || null;
        modelInstance._changes = {};

        modelInstance.toJSON = function() {
            return {
                _map: modelInstance._map,
                _path: modelInstance._path
            };
        };

<<<<<<< HEAD
        if(this._map.id) {
            this._endpoint = TodoItemModel.endpoint + '/' + this._map.id;
=======
        if(modelInstance._map.id) {
            modelInstance._endpoint = modelInstance._model.endpoint + '/' + modelInstance._map.id;
>>>>>>> develop
        }
        else {
            modelInstance._endpoint = null;
        }

<<<<<<< HEAD
        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TodoItemModel.endpoint + '/' + this._map.id;
=======
        modelInstance.cancel = function() {
            modelInstance._changes = {};
        };

        modelInstance.refresh = function(otherInstance) {
        	modelInstance._map = otherInstance._map;
            modelInstance._changes = {};

            if(modelInstance._map.id) {
                modelInstance._endpoint = modelInstance._model.endpoint + '/' + modelInstance._map.id;
>>>>>>> develop
            }
            else {
                modelInstance._endpoint = null;
            }

        	return modelInstance;
        };

        modelInstance.toQueryValue = function() {
        	return modelInstance._map.id;
        };

        modelInstance.remove = function() {
        	return modelInstance._model.remove(modelInstance._map.id);
        };

        modelInstance.save = function() {
            if(modelInstance._map === null) {
                return modelInstance._model.create(modelInstance._changes)
                    .then(function(modelInstance) {
                        return modelInstance.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(modelInstance._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(modelInstance._changes);

                    return modelInstance._model._put(modelInstance._endpoint, queryMap)
                        .then(function(instance) {
<<<<<<< HEAD
                            self._changes = {};
=======
                            modelInstance._changes = {};
>>>>>>> develop

                            Object.keys(instance._map).forEach(function(key) {
                                if(instance._map[key] !== null) {
                                    modelInstance._map[key] = instance._map[key];
                                }
                            });
                            return modelInstance;
                        });
                }
                else {
                    return $q.when(modelInstance);
                }
            }
        };
    }

    this.parseAssociation = function(modelInstance, propertyName, resourceName, associatedModelName) {
        if(typeof modelInstance._map[propertyName] != 'undefined' && modelInstance._map[propertyName] !== null) {
            if(Array.isArray(modelInstance._map[propertyName])) {
                modelInstance._map[propertyName] = modelInstance._map[propertyName].map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstance' + associatedModelName);
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, modelInstance._path + '/' + resourceName);
                    }
                    else {
                        return new fireModelInstanceConstructor(object, modelInstance._path + '/' + resourceName);
                    }
                });
            }
            else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstance' + associatedModelName);
                if(modelInstance._map[propertyName]._map) {
                    modelInstance._map[propertyName] = new fireModelInstanceConstructor(modelInstance._map[propertyName]._map, modelInstance._path + '/' + '');
                }
                else {
                    modelInstance._map[propertyName] = new fireModelInstanceConstructor(modelInstance._map[propertyName], modelInstance._path + '/' + '');
                }
            }
        }
    }

<<<<<<< HEAD


        this.getList = function() {
            console.log('Warning: getList is deprecated. Please use get instead.');
        };

        this.createList = function() {
            console.log('Warning: createList is deprecated. Please use create instead.');
        };

        this.removeList = function() {
            console.log('Warning: removeList is deprecated. Please use remove instead.');
        };

        this.getList = function(queryMap, optionsMap) {
            return $injector.get('TodoListModel')._find(TodoItemModel.endpoint + '/' + this.id + '/list', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TodoListModel').endpoint + '/' + modelInstance.id;
=======
    this.parseProperty = function(modelInstance, propertyName) {
        Object.defineProperty(modelInstance, propertyName, {
            get: function() {
                if(typeof modelInstance._changes[propertyName] != 'undefined') {
                    return modelInstance._changes[propertyName];
                }

                return modelInstance._map[propertyName];
            },

            set: function(value) {
                modelInstance._changes[propertyName] = value;
            }
        });
    }

    this.createOneToOneMethods = function(modelInstance, modelName, propertyName, resource, singularMethodName) {
        modelInstance['get' + singularMethodName] = function(queryMap, optionsMap) {
            return $injector.get(modelName + 'Model')._find(modelInstance._model.endpoint + '/' + this.id + '/' + resource, queryMap, optionsMap)
                .then(function(foundModelInstance) {
                    if(foundModelInstance) {
                        if(foundModelInstance) {
        					foundModelInstance._endpoint = $injector.get(modelName + 'Model').endpoint + '/' + foundModelInstance.id;
>>>>>>> develop
        				}

                        modelInstance[propertyName] = foundModelInstance;
                        return foundModelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        modelInstance['create' + singularMethodName] = function(queryMap) {
            return $injector.get(modelName + 'Model')._create(modelInstance._model.endpoint + '/' + this.id + '/' + resource, queryMap)
                .then(function(createdModelInstance) {
                    modelInstance[propertyName] = createdModelInstance;
                    return createdModelInstance;
                });
        };

        modelInstance['remove' + singularMethodName] = function() {
            return $injector.get(modelName + 'Model')._action('delete', modelInstance._model.endpoint + '/' + this.id + '/' + resource)
                .then(function(removedModelInstance) {
                    modelInstance[propertyName] = null;
                    return removedModelInstance;
                });
        };
    };

    this.createXToManyMethods = function(modelInstance, modelName, propertyName, resource, singularMethodName, pluralMethodName) {
        modelInstance['get' + pluralMethodName] = function(queryMap, optionsMap) {
        	return $injector.get(modelName + 'Model')._find(modelInstance._model.endpoint + '/' + this.id + '/' + resource, queryMap, optionsMap)
                .then(function(modelInstances) {
                    modelInstance[propertyName] = modelInstances;
                    return modelInstances;
                })
        };

        modelInstance['create' + singularMethodName] = function(queryMap) {
            return $injector.get(modelName + 'Model')._create(modelInstance._model.endpoint + '/' + this.id + '/' + resource, queryMap)
                .then(function(createdModelInstance) {
                    if(!modelInstance[propertyName]) {
                        modelInstance[propertyName] = [];
                    }

                    // TODO: How should we sort these associations?
                    modelInstance[propertyName].push(createdModelInstance);
                    return createdModelInstance;
                });
        };

<<<<<<< HEAD
        return (function(){
		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')}, {cache: 1000 * 10, autoReload: true});
		}
		else {
			return TodoListModel
				.create({})
				.then(function(list) {
					_StorageService.set('list', list.id);
					return list;
				});
		}
	}.bind(this))();
    };


    return model;
}]);

app.factory('FireModelInstanceTodoList', ['TodoListModel', '$q', '$http', '$injector', function(TodoListModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTodoList only accepts two arguments now.');
        }

        this._map = setMap || null;
        this._changes = {};

        this.toJSON = function() {
            return {
                _map: this._map,
                _path: path
            };
        };

        if(this._map.id) {
            this._endpoint = TodoListModel.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;



    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes.id != 'undefined') {
    				return self._changes.id;
    			}

    			return self._map.id;
    		},

    		set: function(value) {
    			self._changes.id = value;
    		}
    	});


    	if(typeof setMap.items != 'undefined' && setMap.items !== null) {
    		if(Array.isArray(setMap.items)) {
    			setMap.items = setMap.items.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoItem');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'items');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'items');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTodoItem');
                if(setMap.items._map) {
    			    setMap.items = new fireModelInstanceConstructor(setMap.items._map, path + '/' + 'items');
                }
                else {
                    setMap.items = new fireModelInstanceConstructor(setMap.items, path + '/' + 'items');
                }
    		}
    	}


    	Object.defineProperty(this, 'items', {
    		get: function() {
    			if(typeof self._changes.items != 'undefined') {
    				return self._changes.items;
    			}

    			return self._map.items;
    		},

    		set: function(value) {
    			self._changes.items = value;
    		}
    	});



    	Object.defineProperty(this, 'createdAt', {
    		get: function() {
    			if(typeof self._changes.createdAt != 'undefined') {
    				return self._changes.createdAt;
    			}

    			return self._map.createdAt;
    		},

    		set: function(value) {
    			self._changes.createdAt = value;
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
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TodoListModel.endpoint + '/' + this._map.id;
            }
            else {
                this._endpoint = null;
            }

        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TodoListModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return TodoListModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return TodoListModel._put(this._endpoint, queryMap)
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
                    return $q.when(this);
                }
            }
        };


        this.getCurrentList = function() {
            var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

            return (function(){
		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')}, {cache: 1000 * 10, autoReload: true});
		}
		else {
			return TodoListModel
				.create({})
				.then(function(list) {
					_StorageService.set('list', list.id);
					return list;
				});
		}
	}.bind(this))();
        };





        this.getItems = function(queryMap, optionsMap) {
        	return $injector.get('TodoItemModel')._find(TodoListModel.endpoint + '/' + this.id + '/items', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.items = modelInstances;
                    return modelInstances;
                })
        };

        this.createItem = function(queryMap) {
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

app.factory('TestModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('Test', [], '/api/tests');





    return model;
}]);

app.factory('FireModelInstanceTest', ['TestModel', '$q', '$http', '$injector', function(TestModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTest only accepts two arguments now.');
        }

        this._map = setMap || null;
        this._changes = {};

        this.toJSON = function() {
            return {
                _map: this._map,
                _path: path
            };
        };

        if(this._map.id) {
            this._endpoint = TestModel.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;



    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes.id != 'undefined') {
    				return self._changes.id;
    			}

    			return self._map.id;
    		},

    		set: function(value) {
    			self._changes.id = value;
    		}
    	});



    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes.name != 'undefined') {
    				return self._changes.name;
    			}

    			return self._map.name;
    		},

    		set: function(value) {
    			self._changes.name = value;
    		}
    	});


    	if(typeof setMap.sessions != 'undefined' && setMap.sessions !== null) {
    		if(Array.isArray(setMap.sessions)) {
    			setMap.sessions = setMap.sessions.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'sessions');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'sessions');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                if(setMap.sessions._map) {
    			    setMap.sessions = new fireModelInstanceConstructor(setMap.sessions._map, path + '/' + 'sessions');
                }
                else {
                    setMap.sessions = new fireModelInstanceConstructor(setMap.sessions, path + '/' + 'sessions');
                }
    		}
    	}


    	Object.defineProperty(this, 'sessions', {
    		get: function() {
    			if(typeof self._changes.sessions != 'undefined') {
    				return self._changes.sessions;
    			}

    			return self._map.sessions;
    		},

    		set: function(value) {
    			self._changes.sessions = value;
    		}
    	});


    	if(typeof setMap.variants != 'undefined' && setMap.variants !== null) {
    		if(Array.isArray(setMap.variants)) {
    			setMap.variants = setMap.variants.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestVariant');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'variants');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'variants');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestVariant');
                if(setMap.variants._map) {
    			    setMap.variants = new fireModelInstanceConstructor(setMap.variants._map, path + '/' + 'variants');
                }
                else {
                    setMap.variants = new fireModelInstanceConstructor(setMap.variants, path + '/' + 'variants');
                }
    		}
    	}


    	Object.defineProperty(this, 'variants', {
    		get: function() {
    			if(typeof self._changes.variants != 'undefined') {
    				return self._changes.variants;
    			}

    			return self._map.variants;
    		},

    		set: function(value) {
    			self._changes.variants = value;
    		}
    	});














        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TestModel.endpoint + '/' + this._map.id;
            }
            else {
                this._endpoint = null;
            }

        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return TestModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return TestModel._put(this._endpoint, queryMap)
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
                    return $q.when(this);
                }
            }
        };






        this.getSessions = function(queryMap, optionsMap) {
        	return $injector.get('TestSessionModel')._find(TestModel.endpoint + '/' + this.id + '/sessions', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.sessions = modelInstances;
                    return modelInstances;
                })
        };

        this.createSession = function(queryMap) {
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
        	return $injector.get('TestVariantModel')._find(TestModel.endpoint + '/' + this.id + '/variants', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.variants = modelInstances;
                    return modelInstances;
                })
        };

        this.createVariant = function(queryMap) {
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

app.factory('TestParticipantModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TestParticipant', [], '/api/test-participants');





    return model;
}]);

app.factory('FireModelInstanceTestParticipant', ['TestParticipantModel', '$q', '$http', '$injector', function(TestParticipantModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestParticipant only accepts two arguments now.');
        }

        this._map = setMap || null;
        this._changes = {};

        this.toJSON = function() {
            return {
                _map: this._map,
                _path: path
            };
        };

        if(this._map.id) {
            this._endpoint = TestParticipantModel.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;



    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes.id != 'undefined') {
    				return self._changes.id;
    			}

    			return self._map.id;
    		},

    		set: function(value) {
    			self._changes.id = value;
    		}
    	});


    	if(typeof setMap.sessions != 'undefined' && setMap.sessions !== null) {
    		if(Array.isArray(setMap.sessions)) {
    			setMap.sessions = setMap.sessions.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'sessions');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'sessions');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestSession');
                if(setMap.sessions._map) {
    			    setMap.sessions = new fireModelInstanceConstructor(setMap.sessions._map, path + '/' + 'sessions');
                }
                else {
                    setMap.sessions = new fireModelInstanceConstructor(setMap.sessions, path + '/' + 'sessions');
                }
    		}
    	}


    	Object.defineProperty(this, 'sessions', {
    		get: function() {
    			if(typeof self._changes.sessions != 'undefined') {
    				return self._changes.sessions;
    			}

    			return self._map.sessions;
    		},

    		set: function(value) {
    			self._changes.sessions = value;
    		}
    	});










        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TestParticipantModel.endpoint + '/' + this._map.id;
            }
            else {
                this._endpoint = null;
            }

        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestParticipantModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return TestParticipantModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return TestParticipantModel._put(this._endpoint, queryMap)
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
                    return $q.when(this);
                }
            }
        };






        this.getSessions = function(queryMap, optionsMap) {
        	return $injector.get('TestSessionModel')._find(TestParticipantModel.endpoint + '/' + this.id + '/sessions', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.sessions = modelInstances;
                    return modelInstances;
                })
        };

        this.createSession = function(queryMap) {
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
=======
        modelInstance['remove' + singularMethodName] = function(modelInstanceOrUUID) {
>>>>>>> develop
            var UUID = _getUUID(modelInstanceOrUUID);

            return $injector.get(modelName + 'Model')._action('delete', modelInstance._model.endpoint + '/' + this.id + '//' + UUID)
                .then(function(removedModelInstance) {
<<<<<<< HEAD
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

app.factory('TestSessionModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TestSession', [], '/api/test-sessions');





    return model;
}]);

app.factory('FireModelInstanceTestSession', ['TestSessionModel', '$q', '$http', '$injector', function(TestSessionModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestSession only accepts two arguments now.');
        }

        this._map = setMap || null;
        this._changes = {};

        this.toJSON = function() {
            return {
                _map: this._map,
                _path: path
            };
        };

        if(this._map.id) {
            this._endpoint = TestSessionModel.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;



    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes.id != 'undefined') {
    				return self._changes.id;
    			}

    			return self._map.id;
    		},

    		set: function(value) {
    			self._changes.id = value;
    		}
    	});


    	if(typeof setMap.test != 'undefined' && setMap.test !== null) {
    		if(Array.isArray(setMap.test)) {
    			setMap.test = setMap.test.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'tests');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'tests');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTest');
                if(setMap.test._map) {
    			    setMap.test = new fireModelInstanceConstructor(setMap.test._map, path + '/' + 'tests');
                }
                else {
                    setMap.test = new fireModelInstanceConstructor(setMap.test, path + '/' + 'tests');
                }
    		}
    	}


    	Object.defineProperty(this, 'test', {
    		get: function() {
    			if(typeof self._changes.test != 'undefined') {
    				return self._changes.test;
    			}

    			return self._map.test;
    		},

    		set: function(value) {
    			self._changes.test = value;
    		}
    	});


    	if(typeof setMap.participant != 'undefined' && setMap.participant !== null) {
    		if(Array.isArray(setMap.participant)) {
    			setMap.participant = setMap.participant.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'participants');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'participants');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
                if(setMap.participant._map) {
    			    setMap.participant = new fireModelInstanceConstructor(setMap.participant._map, path + '/' + 'participants');
                }
                else {
                    setMap.participant = new fireModelInstanceConstructor(setMap.participant, path + '/' + 'participants');
                }
    		}
    	}


    	Object.defineProperty(this, 'participant', {
    		get: function() {
    			if(typeof self._changes.participant != 'undefined') {
    				return self._changes.participant;
    			}

    			return self._map.participant;
    		},

    		set: function(value) {
    			self._changes.participant = value;
    		}
    	});



    	Object.defineProperty(this, 'variant', {
    		get: function() {
    			if(typeof self._changes.variant != 'undefined') {
    				return self._changes.variant;
    			}

    			return self._map.variant;
    		},

    		set: function(value) {
    			self._changes.variant = value;
    		}
    	});



    	Object.defineProperty(this, 'createdAt', {
    		get: function() {
    			if(typeof self._changes.createdAt != 'undefined') {
    				return self._changes.createdAt;
    			}

    			return self._map.createdAt;
    		},

    		set: function(value) {
    			self._changes.createdAt = value;
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
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TestSessionModel.endpoint + '/' + this._map.id;
            }
            else {
                this._endpoint = null;
            }

        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return TestSessionModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return TestSessionModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return TestSessionModel._put(this._endpoint, queryMap)
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
                    return $q.when(this);
                }
            }
        };





        this.getTest = function() {
            console.log('Warning: getTest is deprecated. Please use get instead.');
        };

        this.createTest = function() {
            console.log('Warning: createTest is deprecated. Please use create instead.');
        };

        this.removeTest = function() {
            console.log('Warning: removeTest is deprecated. Please use remove instead.');
        };

        this.getTest = function(queryMap, optionsMap) {
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
=======
                    for(var i = 0, il = modelInstance[propertyName].length; i < il; i++) {
                        var instance = modelInstance[propertyName][i];

                        if(instance.id === UUID) {
                            modelInstance[propertyName].splice(i, 1);
                            break;
                        }
>>>>>>> develop
                    }
                    return removedModelInstance;
                });
        };

        modelInstance['remove' + pluralMethodName] = function(map) {
            return $injector.get(modelName + 'Model')._action('delete', modelInstance._model.endpoint + '/' + this.id + '/' + resource, modelInstance._model._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(instance) {
                        return instance.id;
                    });

<<<<<<< HEAD
        this.removeTest = function() {
            return $injector.get('TestModel')._action('delete', TestSessionModel.endpoint + '/' + this.id + '/test')
                .then(function(removeModelInstance) {
                    self.test = null;
                    return removeModelInstance;
                });
        };




        this.getParticipant = function() {
            console.log('Warning: getParticipant is deprecated. Please use get instead.');
        };

        this.createParticipant = function() {
            console.log('Warning: createParticipant is deprecated. Please use create instead.');
        };

        this.removeParticipant = function() {
            console.log('Warning: removeParticipant is deprecated. Please use remove instead.');
        };

        this.getParticipant = function(queryMap, optionsMap) {
            return $injector.get('TestParticipantModel')._find(TestSessionModel.endpoint + '/' + this.id + '/participant', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestParticipantModel').endpoint + '/' + modelInstance.id;
        				}
=======
                    modelInstance[propertyName] = modelInstance[propertyName].filter(function(instance) {
                        return (ids.indexOf(instance.id) === -1);
                    });
>>>>>>> develop

                    return removedModelInstances;
                });
        };

        modelInstance['update' + pluralMethodName] = function(where, set) {
            return $injector.get(modelName + 'Model')._put(modelInstance._model.endpoint + '/' + this.id + '/' + resource, transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = modelInstance[propertyName].length; j < jl; j++) {
                            var instance = modelInstance[propertyName][j];

                            if(instance.id == updatedModelInstance.id) {
                                Object.keys(updatedModelInstance._map).forEach(function(key) {
                                    if(updatedModelInstance._map[key] !== null) {
                                        instance._map[key] = updatedModelInstance._map[key];
                                    }
                                });
                                break;
                            }
                        }
                    }
                    return updatedModelInstances;
                });
        };
    };
}]);


app.factory('TodoItemModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TodoItem', ['TodoList'], '/api/todo-items');





    return model;
}]);

app.factory('FireModelInstanceTodoItem', ['TodoItemModel', '$q', '$http', '$injector', 'FireModelInstance', function(TodoItemModel, $q, $http, $injector, FireModelInstance) {
    return function(setMap, path, shouldBeUndefined) {
<<<<<<< HEAD
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceTestVariant only accepts two arguments now.');
        }

        this._map = setMap || null;
        this._changes = {};

        this.toJSON = function() {
            return {
                _map: this._map,
                _path: path
            };
        };

        if(this._map.id) {
            this._endpoint = TestVariantModel.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }
=======
        FireModelInstance.construct(this, setMap, path, TodoItemModel);
>>>>>>> develop

        var self = this;



    	FireModelInstance.parseProperty(this, 'id');


    	FireModelInstance.parseAssociation(this, 'list', 'lists', 'TodoList');


    	FireModelInstance.parseProperty(this, 'list');



    	FireModelInstance.parseProperty(this, 'name');



    	FireModelInstance.parseProperty(this, 'completed');



    	FireModelInstance.parseProperty(this, 'createdAt');












        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }






<<<<<<< HEAD
        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TestVariantModel.endpoint + '/' + this._map.id;
            }
            else {
                this._endpoint = null;
            }
=======



        FireModelInstance.createOneToOneMethods(this, 'TodoList', 'list', 'list', 'List');


>>>>>>> develop

    };
}]);

app.factory('TodoListModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TodoList', ['TodoItem'], '/api/todo-lists');




    model.getCurrentList = function() {
        var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

<<<<<<< HEAD
                    return TestVariantModel._put(this._endpoint, queryMap)
                        .then(function(instance) {
                            self._changes = {};
=======
        return (function(){
		var _create = function() {
			return TodoListModel
				.create({})
				.then(function(list) {
					_StorageService.set('list', list.id);
					return list;
				});
		};

		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')})
				.then(function(list) {
					return list || _create();
				});
		}
		else {
			return _create();
		}
	}.bind(this))();
    };

>>>>>>> develop

    return model;
}]);

app.factory('FireModelInstanceTodoList', ['TodoListModel', '$q', '$http', '$injector', 'FireModelInstance', function(TodoListModel, $q, $http, $injector, FireModelInstance) {
    return function(setMap, path, shouldBeUndefined) {
        FireModelInstance.construct(this, setMap, path, TodoListModel);

<<<<<<< HEAD


        this.getTest = function() {
            console.log('Warning: getTest is deprecated. Please use get instead.');
        };

        this.createTest = function() {
            console.log('Warning: createTest is deprecated. Please use create instead.');
        };

        this.removeTest = function() {
            console.log('Warning: removeTest is deprecated. Please use remove instead.');
        };

        this.getTest = function(queryMap, optionsMap) {
            return $injector.get('TestModel')._find(TestVariantModel.endpoint + '/' + this.id + '/test', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestModel').endpoint + '/' + modelInstance.id;
        				}
=======
        var self = this;


>>>>>>> develop

    	FireModelInstance.parseProperty(this, 'id');


    	FireModelInstance.parseAssociation(this, 'items', 'items', 'TodoItem');


    	FireModelInstance.parseProperty(this, 'items');



    	FireModelInstance.parseProperty(this, 'createdAt');








        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }



<<<<<<< HEAD
function unwrap(promise, initialValue) {
    var value = initialValue;
=======

>>>>>>> develop


        this.getCurrentList = function() {
            var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

<<<<<<< HEAD
app.service('fire', [function() {
    function unwrap(promise, initialValue) {
        var value = initialValue;
=======
            return (function(){
		var _create = function() {
			return TodoListModel
				.create({})
				.then(function(list) {
					_StorageService.set('list', list.id);
					return list;
				});
		};
>>>>>>> develop

		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')})
				.then(function(list) {
					return list || _create();
				});
		}
		else {
			return _create();
		}
	}.bind(this))();
        };





        FireModelInstance.createXToManyMethods(this, 'TodoItem', 'items', 'items', 'Item', 'Items');


    };
<<<<<<< HEAD
    this.unwrap = unwrap;
=======
}]);
>>>>>>> develop

app.service('fire', [function() {
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
			return TodoListModel.getCurrentList();
		}],

        }
    });

    $routeProvider.when('/:status', {
        templateUrl: '/templates/todo.html',
        controller: 'TodoController',
        resolve: {


            list: ['TodoListModel', function(TodoListModel) {
			return TodoListModel.getCurrentList();
		}],

        }
    });


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
				if(_delegate && typeof _delegate == 'function') {
					_delegate(test, variant);
				}
			}
		};
	}
}]);
