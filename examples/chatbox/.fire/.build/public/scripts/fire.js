var angular = require('angular');
var app = angular.module('default', [require('angular-route')]);


app.directive('autoFocus', [function() {
    return function(scope, element) {
        element.focus();
    };
}]);



app.controller('StartController', ['$scope', 'user', 'MessageModel', 'UserModel', '$window', function($scope, user, MessageModel, UserModel, $window) {
	$scope.user = user;
	$scope.messageStream = MessageModel.stream({}, {limit: 30, orderBy:{createdAt: 1}});

	$scope.createMessage = function(text) {
		return MessageModel.create({text: text})
			.then(function() {
				$scope.chatForm.$setPristine();
			})
			.catch(function() {
				$window.alert('Aye, some things went wrong. Can you try again?');
			});
	};

	$scope.createUser = function(email, name, password) {
		return UserModel.create({email: email, name: name, password: password})
			.then(function(user) {
				$scope.user = user;
			})
			.catch(function() {
				$window.alert('Oi, some things went wrong. Can you try that again?');
			});
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
        console.log('Socket error');
        console.log(error);
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
        console.log('parseMessage');
        console.log(messageMap);

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


app.factory('UserModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', '_CacheService', function($http, $q, FireModel, $injector, $route, $routeParams, $location, _CacheService) {
    var model = new FireModel('User', ['Message'], '/api/users');

    
    var __authenticator = null;

    model.forgotPassword = function(email) {
    	return this._delete(this.endpoint + '/password', { email: email });
    };

    model.resetPassword = function(resetToken, newPassword, confirmPassword) {
    	if(newPassword != confirmPassword) {
    		var defer = $q.defer();
    		var error = new FireError('The passwords do not match! Please enter the same password twice.');
    		error.number = 400;
    		defer.reject(error);
    		return defer.promise;
    	}

    	return this._post(this.endpoint + '/password', {resetToken: resetToken, newPassword: newPassword, confirmPassword: confirmPassword});
    };

    model.changePassword = function(currentPassword, newPassword, confirmPassword) {
        if(newPassword != confirmPassword) {
    		var defer = $q.defer();
    		var error = new FireError('The passwords do not match! Please enter the same password twice.');
    		error.number = 400;
    		defer.reject(error);
    		return defer.promise;
    	}

        return this._put(this.endpoint + '/password', {currentPassword: currentPassword, newPassword: newPassword, confirmPassword: confirmPassword});
    };

    model.signOut = function() {
        return this._delete(this.endpoint + '/access-token')
            .then(function() {
                _CacheService.removeAll();
                __authenticator = null;
            });
    };

    model.authorize = function(fields) {
    	if(!fields.password || !fields.email) {
    		var defer = $q.defer();
    		var error = new FireError('Please fill in a email and password!');
    		error.number = 400;
    		defer.reject(error);
    		return defer.promise;
    	}
    	else {
    		var self = this;
    		return this._post(this.endpoint + '/access-token', fields)
    			.then(function(authenticator) {
    				if(authenticator) {
                        _CacheService.removeAll();

    					authenticator._endpoint = self.endpoint + '/' + authenticator.id;

    					__authenticator = authenticator;
    					return __authenticator;
    				}
    				else {
    					var error = new FireError();
    					error.number = 404;
    					throw error;
    				}
    			});
    	}
    };

    model.findMe = function() {
        var defer = $q.defer();

        if(__authenticator) {
            defer.resolve(__authenticator);
        }
        else {
            var self = this;

            var query = {};
            if($routeParams.t || $route && $route.current && $route.current.params && $route.current.params.t) {
                query.t = $routeParams.t || $route.current.params.t;
            }

    		this._get(this.endpoint + '/me', query)
                .then(function(authenticator) {
                    if(authenticator) {
                        $location.search('t', null);
                        authenticator._endpoint = self.endpoint + '/' + authenticator.id;

                        __authenticator = authenticator;
                        defer.resolve(__authenticator);
                    }
                    else {
                        defer.resolve(null);
                    }
                })
                .catch(function(error) {
                    defer.resolve(null);
                });
        }

        return defer.promise;
    };

    model.getLoginToken = function() {
        throw new Error('This method is not available in the front-end. Please use this in the back-end instead.');
    };

    model.getMe = function() {
    	var defer = $q.defer();

        // TODO: Use model#findMe instead.

    	if(__authenticator) {
    		defer.resolve(__authenticator);
    	}
    	else {
    		var self = this;

            var query = {};
            if($routeParams.t || $route && $route.current && $route.current.params && $route.current.params.t) {
                query.t = $routeParams.t || $route.current.params.t;
            }

    		this._get(this.endpoint + '/me', query)
    			.then(function(authenticator) {
    				if(authenticator) {
                        $location.search('t', null);
    					authenticator._endpoint = self.endpoint + '/' + authenticator.id;

    					__authenticator = authenticator;
    					defer.resolve(__authenticator);
    				}
    				else {
    					defer.reject(new Error('Unauthorized'));
    				}
    			})
    			.catch(function(error) {
    				defer.reject(error);
    			});
    	}

    	return defer.promise;
    };
    

    

    return model;
}]);

app.factory('FireModelInstanceUser', ['UserModel', '$q', '$http', '$injector', function(UserModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceUser only accepts two arguments now.');
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
            this._endpoint = UserModel.endpoint + '/' + this._map.id;
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
    
    	
    	if(typeof setMap.passwordReset != 'undefined' && setMap.passwordReset !== null) {
    		if(Array.isArray(setMap.passwordReset)) {
    			setMap.passwordReset = setMap.passwordReset.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceUserResetPassword');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'password-resets');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'password-resets');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceUserResetPassword');
                if(setMap.passwordReset._map) {
    			    setMap.passwordReset = new fireModelInstanceConstructor(setMap.passwordReset._map, path + '/' + 'password-resets');
                }
                else {
                    setMap.passwordReset = new fireModelInstanceConstructor(setMap.passwordReset, path + '/' + 'password-resets');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'passwordReset', {
    		get: function() {
    			if(typeof self._changes.passwordReset != 'undefined') {
    				return self._changes.passwordReset;
    			}

    			return self._map.passwordReset;
    		},

    		set: function(value) {
    			self._changes.passwordReset = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'accessToken', {
    		get: function() {
    			if(typeof self._changes.accessToken != 'undefined') {
    				return self._changes.accessToken;
    			}

    			return self._map.accessToken;
    		},

    		set: function(value) {
    			self._changes.accessToken = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'email', {
    		get: function() {
    			if(typeof self._changes.email != 'undefined') {
    				return self._changes.email;
    			}

    			return self._map.email;
    		},

    		set: function(value) {
    			self._changes.email = value;
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
    
    	

    	Object.defineProperty(this, 'avatarUrl', {
    		get: function() {
    			if(typeof self._changes.avatarUrl != 'undefined') {
    				return self._changes.avatarUrl;
    			}

    			return self._map.avatarUrl;
    		},

    		set: function(value) {
    			self._changes.avatarUrl = value;
    		}
    	});
    
    	
    	if(typeof setMap.messages != 'undefined' && setMap.messages !== null) {
    		if(Array.isArray(setMap.messages)) {
    			setMap.messages = setMap.messages.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceMessage');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'messages');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'messages');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceMessage');
                if(setMap.messages._map) {
    			    setMap.messages = new fireModelInstanceConstructor(setMap.messages._map, path + '/' + 'messages');
                }
                else {
                    setMap.messages = new fireModelInstanceConstructor(setMap.messages, path + '/' + 'messages');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'messages', {
    		get: function() {
    			if(typeof self._changes.messages != 'undefined') {
    				return self._changes.messages;
    			}

    			return self._map.messages;
    		},

    		set: function(value) {
    			self._changes.messages = value;
    		}
    	});
    
    	
    	if(typeof setMap.testParticipant != 'undefined' && setMap.testParticipant !== null) {
    		if(Array.isArray(setMap.testParticipant)) {
    			setMap.testParticipant = setMap.testParticipant.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'test-participants');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'test-participants');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceTestParticipant');
                if(setMap.testParticipant._map) {
    			    setMap.testParticipant = new fireModelInstanceConstructor(setMap.testParticipant._map, path + '/' + 'test-participants');
                }
                else {
                    setMap.testParticipant = new fireModelInstanceConstructor(setMap.testParticipant, path + '/' + 'test-participants');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'testParticipant', {
    		get: function() {
    			if(typeof self._changes.testParticipant != 'undefined') {
    				return self._changes.testParticipant;
    			}

    			return self._map.testParticipant;
    		},

    		set: function(value) {
    			self._changes.testParticipant = value;
    		}
    	});
    

    
        
    
        
    
        
    
        
    
        
    
        
    
        
    
        
    


        this.changePassword = function(currentPassword, newPassword, confirmPassword) {
            return UserModel.changePassword(currentPassword, newPassword, confirmPassword);
        };

        this.signOut = function() {
            return UserModel.signOut();
        };


        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = UserModel.endpoint + '/' + this._map.id;
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
        	return UserModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return UserModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return UserModel._put(this._endpoint, queryMap)
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

        

        
        
        this.getPasswordreset = function() {
            console.log('Warning: getPasswordreset is deprecated. Please use get instead.');
        };

        this.createPasswordreset = function() {
            console.log('Warning: createPasswordreset is deprecated. Please use create instead.');
        };

        this.removePasswordreset = function() {
            console.log('Warning: removePasswordreset is deprecated. Please use remove instead.');
        };

        this.getPasswordReset = function(queryMap, optionsMap) {
            return $injector.get('UserResetPasswordModel')._find(UserModel.endpoint + '/' + this.id + '/password-reset', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('UserResetPasswordModel').endpoint + '/' + modelInstance.id;
        				}

                        self.passwordReset = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createPasswordReset = function(queryMap) {
            return $injector.get('UserResetPasswordModel')._create(UserModel.endpoint + '/' + this.id + '/password-reset', queryMap)
                .then(function(modelInstance) {
                    self.passwordReset = modelInstance;
                    return modelInstance;
                });
        };

        this.removePasswordReset = function() {
            return $injector.get('UserResetPasswordModel')._action('delete', UserModel.endpoint + '/' + this.id + '/password-reset')
                .then(function(removeModelInstance) {
                    self.passwordReset = null;
                    return removeModelInstance;
                });
        };
        
        
        
        
        
        this.getMessages = function(queryMap, optionsMap) {
        	return $injector.get('MessageModel')._find(UserModel.endpoint + '/' + this.id + '/messages', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.messages = modelInstances;
                    return modelInstances;
                })
        };

        this.createMessage = function(queryMap) {
            return $injector.get('MessageModel')._create(UserModel.endpoint + '/' + this.id + '/messages', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.messages) {
                        self.messages = [];
                    }

                    // TODO: How should we sort these associations?
                    self.messages.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.removeMessage = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            return $injector.get('MessageModel')._action('delete', UserModel.endpoint + '/' + this.id + '/messages/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.messages.length; i < il; i++) {
                        var modelInstance = self.messages[i];

                        if(modelInstance.id === UUID) {
                            self.messages.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.removeMessages = function(map) {
            return $injector.get('MessageModel')._action('delete', UserModel.endpoint + '/' + this.id + '/messages', UserModel._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.messages = self.messages.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.updateMessages = function(where, set) {
            return $injector.get('MessageModel')._put(UserModel.endpoint + '/' + this.id + '/messages', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.messages.length; j < jl; j++) {
                            var modelInstance = self.messages[j];

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

        
        
        
        this.getTestparticipant = function() {
            console.log('Warning: getTestparticipant is deprecated. Please use get instead.');
        };

        this.createTestparticipant = function() {
            console.log('Warning: createTestparticipant is deprecated. Please use create instead.');
        };

        this.removeTestparticipant = function() {
            console.log('Warning: removeTestparticipant is deprecated. Please use remove instead.');
        };

        this.getTestParticipant = function(queryMap, optionsMap) {
            return $injector.get('TestParticipantModel')._find(UserModel.endpoint + '/' + this.id + '/test-participant', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('TestParticipantModel').endpoint + '/' + modelInstance.id;
        				}

                        self.testParticipant = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createTestParticipant = function(queryMap) {
            return $injector.get('TestParticipantModel')._create(UserModel.endpoint + '/' + this.id + '/test-participant', queryMap)
                .then(function(modelInstance) {
                    self.testParticipant = modelInstance;
                    return modelInstance;
                });
        };

        this.removeTestParticipant = function() {
            return $injector.get('TestParticipantModel')._action('delete', UserModel.endpoint + '/' + this.id + '/test-participant')
                .then(function(removeModelInstance) {
                    self.testParticipant = null;
                    return removeModelInstance;
                });
        };
        
        
        
    };
}]);

app.factory('MessageModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('Message', ['User'], '/api/messages');

    

    

    return model;
}]);

app.factory('FireModelInstanceMessage', ['MessageModel', '$q', '$http', '$injector', function(MessageModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceMessage only accepts two arguments now.');
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
            this._endpoint = MessageModel.endpoint + '/' + this._map.id;
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
    
    	
    	if(typeof setMap.user != 'undefined' && setMap.user !== null) {
    		if(Array.isArray(setMap.user)) {
    			setMap.user = setMap.user.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'users');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'users');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                if(setMap.user._map) {
    			    setMap.user = new fireModelInstanceConstructor(setMap.user._map, path + '/' + 'users');
                }
                else {
                    setMap.user = new fireModelInstanceConstructor(setMap.user, path + '/' + 'users');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'user', {
    		get: function() {
    			if(typeof self._changes.user != 'undefined') {
    				return self._changes.user;
    			}

    			return self._map.user;
    		},

    		set: function(value) {
    			self._changes.user = value;
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
    
    	

    	Object.defineProperty(this, 'text', {
    		get: function() {
    			if(typeof self._changes.text != 'undefined') {
    				return self._changes.text;
    			}

    			return self._map.text;
    		},

    		set: function(value) {
    			self._changes.text = value;
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
                this._endpoint = MessageModel.endpoint + '/' + this._map.id;
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
        	return MessageModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return MessageModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return MessageModel._put(this._endpoint, queryMap)
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

        

        
        
        this.getUser = function() {
            console.log('Warning: getUser is deprecated. Please use get instead.');
        };

        this.createUser = function() {
            console.log('Warning: createUser is deprecated. Please use create instead.');
        };

        this.removeUser = function() {
            console.log('Warning: removeUser is deprecated. Please use remove instead.');
        };

        this.getUser = function(queryMap, optionsMap) {
            return $injector.get('UserModel')._find(MessageModel.endpoint + '/' + this.id + '/user', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('UserModel').endpoint + '/' + modelInstance.id;
        				}

                        self.user = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createUser = function(queryMap) {
            return $injector.get('UserModel')._create(MessageModel.endpoint + '/' + this.id + '/user', queryMap)
                .then(function(modelInstance) {
                    self.user = modelInstance;
                    return modelInstance;
                });
        };

        this.removeUser = function() {
            return $injector.get('UserModel')._action('delete', MessageModel.endpoint + '/' + this.id + '/user')
                .then(function(removeModelInstance) {
                    self.user = null;
                    return removeModelInstance;
                });
        };
        
        
        
    };
}]);

app.factory('UserResetPasswordModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('UserResetPassword', [], '/api/user-reset-passwords');

    

    

    return model;
}]);

app.factory('FireModelInstanceUserResetPassword', ['UserResetPasswordModel', '$q', '$http', '$injector', function(UserResetPasswordModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceUserResetPassword only accepts two arguments now.');
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
            this._endpoint = UserResetPasswordModel.endpoint + '/' + this._map.id;
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
    
    	
    	if(typeof setMap.authenticator != 'undefined' && setMap.authenticator !== null) {
    		if(Array.isArray(setMap.authenticator)) {
    			setMap.authenticator = setMap.authenticator.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'authenticators');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'authenticators');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                if(setMap.authenticator._map) {
    			    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator._map, path + '/' + 'authenticators');
                }
                else {
                    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator, path + '/' + 'authenticators');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'authenticator', {
    		get: function() {
    			if(typeof self._changes.authenticator != 'undefined') {
    				return self._changes.authenticator;
    			}

    			return self._map.authenticator;
    		},

    		set: function(value) {
    			self._changes.authenticator = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'token', {
    		get: function() {
    			if(typeof self._changes.token != 'undefined') {
    				return self._changes.token;
    			}

    			return self._map.token;
    		},

    		set: function(value) {
    			self._changes.token = value;
    		}
    	});
    

    
        
    
        
    
        
    



        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = UserResetPasswordModel.endpoint + '/' + this._map.id;
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
        	return UserResetPasswordModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return UserResetPasswordModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return UserResetPasswordModel._put(this._endpoint, queryMap)
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

        

        
        
        this.getAuthenticator = function() {
            console.log('Warning: getAuthenticator is deprecated. Please use get instead.');
        };

        this.createAuthenticator = function() {
            console.log('Warning: createAuthenticator is deprecated. Please use create instead.');
        };

        this.removeAuthenticator = function() {
            console.log('Warning: removeAuthenticator is deprecated. Please use remove instead.');
        };

        this.getAuthenticator = function(queryMap, optionsMap) {
            return $injector.get('UserModel')._find(UserResetPasswordModel.endpoint + '/' + this.id + '/authenticator', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('UserModel').endpoint + '/' + modelInstance.id;
        				}

                        self.authenticator = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createAuthenticator = function(queryMap) {
            return $injector.get('UserModel')._create(UserResetPasswordModel.endpoint + '/' + this.id + '/authenticator', queryMap)
                .then(function(modelInstance) {
                    self.authenticator = modelInstance;
                    return modelInstance;
                });
        };

        this.removeAuthenticator = function() {
            return $injector.get('UserModel')._action('delete', UserResetPasswordModel.endpoint + '/' + this.id + '/authenticator')
                .then(function(removeModelInstance) {
                    self.authenticator = null;
                    return removeModelInstance;
                });
        };
        
        
        
    };
}]);

app.factory('UserLoginTokenModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('UserLoginToken', [], '/api/user-login-tokens');

    

    

    return model;
}]);

app.factory('FireModelInstanceUserLoginToken', ['UserLoginTokenModel', '$q', '$http', '$injector', function(UserLoginTokenModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceUserLoginToken only accepts two arguments now.');
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
            this._endpoint = UserLoginTokenModel.endpoint + '/' + this._map.id;
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
    
    	
    	if(typeof setMap.authenticator != 'undefined' && setMap.authenticator !== null) {
    		if(Array.isArray(setMap.authenticator)) {
    			setMap.authenticator = setMap.authenticator.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'authenticators');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'authenticators');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                if(setMap.authenticator._map) {
    			    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator._map, path + '/' + 'authenticators');
                }
                else {
                    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator, path + '/' + 'authenticators');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'authenticator', {
    		get: function() {
    			if(typeof self._changes.authenticator != 'undefined') {
    				return self._changes.authenticator;
    			}

    			return self._map.authenticator;
    		},

    		set: function(value) {
    			self._changes.authenticator = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'token', {
    		get: function() {
    			if(typeof self._changes.token != 'undefined') {
    				return self._changes.token;
    			}

    			return self._map.token;
    		},

    		set: function(value) {
    			self._changes.token = value;
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
                this._endpoint = UserLoginTokenModel.endpoint + '/' + this._map.id;
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
        	return UserLoginTokenModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return UserLoginTokenModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return UserLoginTokenModel._put(this._endpoint, queryMap)
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
    
    	
    	if(typeof setMap.authenticator != 'undefined' && setMap.authenticator !== null) {
    		if(Array.isArray(setMap.authenticator)) {
    			setMap.authenticator = setMap.authenticator.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + 'authenticators');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + 'authenticators');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
                if(setMap.authenticator._map) {
    			    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator._map, path + '/' + 'authenticators');
                }
                else {
                    setMap.authenticator = new fireModelInstanceConstructor(setMap.authenticator, path + '/' + 'authenticators');
                }
    		}
    	}
    	

    	Object.defineProperty(this, 'authenticator', {
    		get: function() {
    			if(typeof self._changes.authenticator != 'undefined') {
    				return self._changes.authenticator;
    			}

    			return self._map.authenticator;
    		},

    		set: function(value) {
    			self._changes.authenticator = value;
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
            var UUID = _getUUID(modelInstanceOrUUID);

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

        
        
        
        this.getAuthenticator = function() {
            console.log('Warning: getAuthenticator is deprecated. Please use get instead.');
        };

        this.createAuthenticator = function() {
            console.log('Warning: createAuthenticator is deprecated. Please use create instead.');
        };

        this.removeAuthenticator = function() {
            console.log('Warning: removeAuthenticator is deprecated. Please use remove instead.');
        };

        this.getAuthenticator = function(queryMap, optionsMap) {
            return $injector.get('UserModel')._find(TestParticipantModel.endpoint + '/' + this.id + '/authenticator', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('UserModel').endpoint + '/' + modelInstance.id;
        				}

                        self.authenticator = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.createAuthenticator = function(queryMap) {
            return $injector.get('UserModel')._create(TestParticipantModel.endpoint + '/' + this.id + '/authenticator', queryMap)
                .then(function(modelInstance) {
                    self.authenticator = modelInstance;
                    return modelInstance;
                });
        };

        this.removeAuthenticator = function() {
            return $injector.get('UserModel')._action('delete', TestParticipantModel.endpoint + '/' + this.id + '/authenticator')
                .then(function(removeModelInstance) {
                    self.authenticator = null;
                    return removeModelInstance;
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
                    }
                });
        };

        this.createTest = function(queryMap) {
            return $injector.get('TestModel')._create(TestSessionModel.endpoint + '/' + this.id + '/test', queryMap)
                .then(function(modelInstance) {
                    self.test = modelInstance;
                    return modelInstance;
                });
        };

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
            return $injector.get('TestParticipantModel')._create(TestSessionModel.endpoint + '/' + this.id + '/participant', queryMap)
                .then(function(modelInstance) {
                    self.participant = modelInstance;
                    return modelInstance;
                });
        };

        this.removeParticipant = function() {
            return $injector.get('TestParticipantModel')._action('delete', TestSessionModel.endpoint + '/' + this.id + '/participant')
                .then(function(removeModelInstance) {
                    self.participant = null;
                    return removeModelInstance;
                });
        };
        
        
        
    };
}]);

app.factory('TestVariantModel', ['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location', function($http, $q, FireModel, $injector, $route, $routeParams, $location) {
    var model = new FireModel('TestVariant', [], '/api/test-variants');

    

    

    return model;
}]);

app.factory('FireModelInstanceTestVariant', ['TestVariantModel', '$q', '$http', '$injector', function(TestVariantModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
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
    
    	

    	Object.defineProperty(this, 'numberOfParticipants', {
    		get: function() {
    			if(typeof self._changes.numberOfParticipants != 'undefined') {
    				return self._changes.numberOfParticipants;
    			}

    			return self._map.numberOfParticipants;
    		},

    		set: function(value) {
    			self._changes.numberOfParticipants = value;
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
    

    
        
    
        
    
        
    
        
    



        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = TestVariantModel.endpoint + '/' + this._map.id;
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
        	return TestVariantModel.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return TestVariantModel.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return TestVariantModel._put(this._endpoint, queryMap)
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
            return $injector.get('TestModel')._create(TestVariantModel.endpoint + '/' + this.id + '/test', queryMap)
                .then(function(modelInstance) {
                    self.test = modelInstance;
                    return modelInstance;
                });
        };

        this.removeTest = function() {
            return $injector.get('TestModel')._action('delete', TestVariantModel.endpoint + '/' + this.id + '/test')
                .then(function(removeModelInstance) {
                    self.test = null;
                    return removeModelInstance;
                });
        };
        
        
        
    };
}]);

function unwrap(promise, initialValue) {
    var value = initialValue;

    promise.then(function(newValue) {
        angular.copy(newValue, value);
    });

    return value;
};

app.service('fire', [function() {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;

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
        templateUrl: '/templates/start.html',
        controller: 'StartController',
        resolve: {
        
        
            user: ['UserModel', function(UserModel) {
			return UserModel.findMe();
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


