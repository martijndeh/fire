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

        this.search = function(searchText, fields, options) {
            var queryMap = transformQueryMap(fields, options);
            return this._action('search', this.endpoint, this._prepare(queryMap))
                .then(function(result) {
                    _CacheService.put(key, result, params.$options && params.$options.cache);
                    return result;
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

{{#models}}
app.factory('{{name}}Model', [{{modelDependencyNames}}, function({{modelDependencies}}) {
    var model = new FireModel('{{name}}', [{{autoFetchedAssociationNames}}], '/api/{{resource}}');

    {{#isAuthenticator}}
    var __authenticator = null;

    model.forgotPassword = function({{authenticatingPropertyName}}) {
    	return this._delete(this.endpoint + '/password', { {{authenticatingPropertyName}}: {{authenticatingPropertyName}} });
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
    	if(!fields.password || !fields.{{authenticatingPropertyName}}) {
    		var defer = $q.defer();
    		var error = new FireError('Please fill in a {{authenticatingPropertyName}} and password!');
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
    {{/isAuthenticator}}

    {{#otherMethods}}
    model.{{methodName}} = function({{parameters}}) {
        {{{injectorsBody}}}
        return (function({{parameters}}){{{methodBody}}}.bind(this))({{parameters}});
    };
    {{/otherMethods}}

    return model;
}]);

app.factory('FireModelInstance{{name}}', [{{modelInstanceDependencyNames}}, function({{modelInstanceDependencies}}) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstance{{name}} only accepts two arguments now.');
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
            this._endpoint = {{name}}Model.endpoint + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    {{#properties}}
    	{{#isAssociation}}
    	if(typeof setMap.{{name}} != 'undefined' && setMap.{{name}} !== null) {
    		if(Array.isArray(setMap.{{name}})) {
    			setMap.{{name}} = setMap.{{name}}.map(function(object) {
                    var fireModelInstanceConstructor = $injector.get('FireModelInstance{{getAssociatedModelName}}');
                    if(object._map) {
                        return new fireModelInstanceConstructor(object._map, path + '/' + '{{resourceName}}');
                    }
                    else {
                        return new fireModelInstanceConstructor(object, path + '/' + '{{resourceName}}');
                    }
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstance{{getAssociatedModelName}}');
                if(setMap.{{name}}._map) {
    			    setMap.{{name}} = new fireModelInstanceConstructor(setMap.{{name}}._map, path + '/' + '{{resourceName}}');
                }
                else {
                    setMap.{{name}} = new fireModelInstanceConstructor(setMap.{{name}}, path + '/' + '{{resourceName}}');
                }
    		}
    	}
    	{{/isAssociation}}

    	Object.defineProperty(this, '{{name}}', {
    		get: function() {
    			if(typeof self._changes.{{name}} != 'undefined') {
    				return self._changes.{{name}};
    			}

    			return self._map.{{name}};
    		},

    		set: function(value) {
    			self._changes.{{name}} = value;
    		}
    	});
    {{/properties}}

    {{#properties}}
        {{#options.isDate}}
        if(setMap.{{name}}) {
            setMap.{{name}} = new Date(setMap.{{name}});
        }
        {{/options.isDate}}
    {{/properties}}

{{#isAuthenticator}}
        this.changePassword = function(currentPassword, newPassword, confirmPassword) {
            return {{name}}Model.changePassword(currentPassword, newPassword, confirmPassword);
        };

        this.signOut = function() {
            return {{name}}Model.signOut();
        };
{{/isAuthenticator}}

        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
            this._changes = {};

            if(this._map.id) {
                this._endpoint = {{name}}Model.endpoint + '/' + this._map.id;
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
        	return {{name}}Model.remove(this._map.id);
        };

        this.save = function() {
            if(this._map === null) {
                return {{name}}Model.create(this._changes)
                    .then(function(modelInstance) {
                        return self.refresh(modelInstance);
                    });
            }
            else {
                var numberOfChanges = Object.keys(this._changes).length;
                if(numberOfChanges) {
                    var queryMap = transformQueryMap(this._changes);

                    return {{name}}Model._put(this._endpoint, queryMap)
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

        {{#otherMethods}}
        this.{{methodName}} = function({{parameters}}) {
            {{{injectorsBody}}}
            return (function({{parameters}}){{{methodBody}}}.bind(this))({{parameters}});
        };
        {{/otherMethods}}

        {{#methods}}
        {{#isOneToOne}}
        this.get{{methodName}} = function() {
            console.log('Warning: get{{methodName}} is deprecated. Please use get{{singuleMethodName}} instead.');
        };

        this.create{{methodName}} = function() {
            console.log('Warning: create{{methodName}} is deprecated. Please use create{{singuleMethodName}} instead.');
        };

        this.remove{{methodName}} = function() {
            console.log('Warning: remove{{methodName}} is deprecated. Please use remove{{singuleMethodName}} instead.');
        };

        this.get{{singularMethodName}} = function(queryMap, optionsMap) {
            return $injector.get('{{modelName}}Model')._find({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap)
                .then(function(modelInstance) {
                    if(modelInstance) {
                        if(modelInstance) {
        					modelInstance._endpoint = $injector.get('{{modelName}}Model').endpoint + '/' + modelInstance.id;
        				}

                        self.{{propertyName}} = modelInstance;
                        return modelInstance;
                    }
                    else {
                        // TODO: Should we set the local property name to null as well?
                        return null;
                    }
                });
        };

        this.create{{singularMethodName}} = function(queryMap) {
            return $injector.get('{{modelName}}Model')._create({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap)
                .then(function(modelInstance) {
                    self.{{propertyName}} = modelInstance;
                    return modelInstance;
                });
        };

        this.remove{{singularMethodName}} = function() {
            return $injector.get('{{modelName}}Model')._action('delete', {{name}}Model.endpoint + '/' + this.id + '/{{resource}}')
                .then(function(removeModelInstance) {
                    self.{{propertyName}} = null;
                    return removeModelInstance;
                });
        };
        {{/isOneToOne}}
        {{#isXToMany}}
        this.get{{pluralMethodName}} = function(queryMap, optionsMap) {
        	return $injector.get('{{modelName}}Model')._find({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.{{propertyName}} = modelInstances;
                    return modelInstances;
                })
        };

        this.create{{singularMethodName}} = function(queryMap) {
            return $injector.get('{{modelName}}Model')._create({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap)
                .then(function(createdModelInstance) {
                    if(!self.{{propertyName}}) {
                        self.{{propertyName}} = [];
                    }

                    // TODO: How should we sort these associations?
                    self.{{propertyName}}.push(createdModelInstance);
                    return createdModelInstance;
                });
        };

        this.remove{{singularMethodName}} = function(modelInstanceOrUUID) {
            var UUID = _getUUID(modelInstanceOrUUID);

            return $injector.get('{{modelName}}Model')._action('delete', {{name}}Model.endpoint + '/' + this.id + '/{{resource}}/' + UUID)
                .then(function(removedModelInstance) {
                    for(var i = 0, il = self.{{propertyName}}.length; i < il; i++) {
                        var modelInstance = self.{{propertyName}}[i];

                        if(modelInstance.id === UUID) {
                            self.{{propertyName}}.splice(i, 1);
                            break;
                        }
                    }
                    return removedModelInstance;
                });
        };

        this.remove{{pluralMethodName}} = function(map) {
            return $injector.get('{{modelName}}Model')._action('delete', {{name}}Model.endpoint + '/' + this.id + '/{{resource}}', {{name}}Model._prepare(transformQueryMap(map)))
                .then(function(removedModelInstances) {
                    var ids = removedModelInstances.map(function(modelInstance) {
                        return modelInstance.id;
                    });

                    self.{{propertyName}} = self.{{propertyName}}.filter(function(modelInstance) {
                        return (ids.indexOf(modelInstance.id) === -1);
                    });

                    return removedModelInstances;
                });
        };

        this.update{{pluralMethodName}} = function(where, set) {
            return $injector.get('{{modelName}}Model')._put({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', transformQueryMap(set), transformQueryMap(where))
                .then(function(updatedModelInstances) {
                    for(var i = 0, il = updatedModelInstances.length; i < il; i++) {
                        var updatedModelInstance = updatedModelInstances[i];

                        for(var j = 0, jl = self.{{propertyName}}.length; j < jl; j++) {
                            var modelInstance = self.{{propertyName}}[j];

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

        {{/isXToMany}}
        {{/methods}}
    };
}]);
{{/models}}
