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

        if(modelInstance._map.id) {
            modelInstance._endpoint = modelInstance._model.endpoint + '/' + modelInstance._map.id;
        }
        else {
            modelInstance._endpoint = null;
        }

        modelInstance.cancel = function() {
            modelInstance._changes = {};
        };

        modelInstance.refresh = function(otherInstance) {
        	modelInstance._map = otherInstance._map;
            modelInstance._changes = {};

            if(modelInstance._map.id) {
                modelInstance._endpoint = modelInstance._model.endpoint + '/' + modelInstance._map.id;
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
                            modelInstance._changes = {};

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

        modelInstance['remove' + singularMethodName] = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            return $injector.get(modelName + 'Model')._action('delete', modelInstance._model.endpoint + '/' + this.id + '//' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = modelInstance[propertyName].length; i < il; i++) {
                        var instance = modelInstance[propertyName][i];

                        if(instance.id === UUID) {
                            modelInstance[propertyName].splice(i, 1);
                            break;
                        }
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

                    modelInstance[propertyName] = modelInstance[propertyName].filter(function(instance) {
                        return (ids.indexOf(instance.id) === -1);
                    });

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
        FireModelInstance.construct(this, setMap, path, TodoItemModel);

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









        FireModelInstance.createOneToOneMethods(this, 'TodoList', 'list', 'list', 'List');



    };
}]);

app.factory('TodoListModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TodoList', ['TodoItem'], '/api/todo-lists');




    model.getCurrentList = function() {
        var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

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


    return model;
}]);

app.factory('FireModelInstanceTodoList', ['TodoListModel', '$q', '$http', '$injector', 'FireModelInstance', function(TodoListModel, $q, $http, $injector, FireModelInstance) {
    return function(setMap, path, shouldBeUndefined) {
        FireModelInstance.construct(this, setMap, path, TodoListModel);

        var self = this;



    	FireModelInstance.parseProperty(this, 'id');


    	FireModelInstance.parseAssociation(this, 'items', 'items', 'TodoItem');


    	FireModelInstance.parseProperty(this, 'items');



    	FireModelInstance.parseProperty(this, 'createdAt');








        if(setMap.createdAt) {
            setMap.createdAt = new Date(setMap.createdAt);
        }






        this.getCurrentList = function() {
            var TodoItemModel = $injector.get('TodoItemModel');
var _StorageService = $injector.get('_StorageService');
var TodoListModel = $injector.get('TodoListModel');

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





        FireModelInstance.createXToManyMethods(this, 'TodoItem', 'items', 'items', 'Item', 'Items');


    };
}]);

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


app.run(['$location', '$window', '$log', function($location, $window, $log) {
    var reload = false;
    var _connect = function() {
        var connected = false;

        var socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
        socket.onopen = function() {
            connected = true;

            if(reload) {
                $log.info('Reconnected. Reloading now.');

                $window.location.reload();
            }
        };

        socket.onclose = function() {
            if(connected) {
                $log.warn('Lost connection. Trying to reconnect.');
            }

            reload = true;

            setTimeout(_connect, 1000);
        };
    };

    _connect();
}]);
