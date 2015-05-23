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

        	var self = this;
        	$http({method: verb, url: path, data: data, params: params, headers: {'x-json-params': true,  'Content-Type': 'application/json;charset=utf-8'}})
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

        this._delete = function(path, fields) {
        	return this._action('delete', path, null, this._prepare(fields));
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

{{#models}}
app.factory('{{name}}Model', [{{modelDependencyNames}}, function({{modelDependencies}}) {
    var model = new FireModel();
    model.endpoint = '/api/{{resource}}';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstance{{name}}');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

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

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
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
                    return new fireModelInstanceConstructor(object, path + '/' + '{{resourceName}}');
    			});
    		}
    		else {
                var fireModelInstanceConstructor = $injector.get('FireModelInstance{{getAssociatedModelName}}');
    			setMap.{{name}} = new fireModelInstanceConstructor(setMap.{{name}}, path + '/' + '{{resourceName}}');
    		}
    	}
    	{{/isAssociation}}

    	Object.defineProperty(this, '{{name}}', {
    		get: function() {
    			if(typeof self._changes['{{name}}'] != 'undefined') {
    				return self._changes['{{name}}'];
    			}

    			return self._map['{{name}}'];
    		},

    		set: function(value) {
    			self._changes['{{name}}'] = value;
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
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return {{name}}Model.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return {{name}}Model._put(self._endpoint, queryMap)
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
                throw new Error('FireModelInstance{{name}}._model is deprecated.');
            }
        });

        {{#otherMethods}}
        this.{{methodName}} = function({{parameters}}) {
            {{{injectorsBody}}}
            return (function({{parameters}}){{{methodBody}}}.bind(this))({{parameters}});
        };
        {{/otherMethods}}

        {{#methods}}
        {{#isOneToOne}}
        this.get{{methodName}} = function(queryMap, optionsMap) {
            var self = this;
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

        this.create{{methodName}} = function(queryMap) {
            var self = this;
            return $injector.get('{{modelName}}Model')._create({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap)
                .then(function(modelInstance) {
                    self.{{propertyName}} = modelInstance;
                    return modelInstance;
                });
        };

        this.remove{{methodName}} = function() {
            var self = this;
            return $injector.get('{{modelName}}Model')._action('delete', {{name}}Model.endpoint + '/' + this.id + '/{{resource}}')
                .then(function(removeModelInstance) {
                    self.{{propertyName}} = null;
                    return removeModelInstance;
                });
        };
        {{/isOneToOne}}
        {{#isXToMany}}
        this.get{{pluralMethodName}} = function(queryMap, optionsMap) {
            var self = this;
        	return $injector.get('{{modelName}}Model')._find({{name}}Model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap)
                .then(function(modelInstances) {
                    self.{{propertyName}} = modelInstances;
                    return modelInstances;
                })
        };

        this.create{{singularMethodName}} = function(queryMap) {
            var self = this;
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

            var self = this;
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
            var self = this;
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
            var self = this;
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
        {{#isHasMethod}}
        this.{{getMethodName}} = function(queryMap, optionsMap) {
            var queryMap = transformQueryMap(fields, options);
            var params = {{name}}Model._prepare(queryMap);

            var defer = $q.defer();
            var path = {{name}}Model.endpoint + '/' + this.id + '/{{resource}}';

            var self = this;
            $http({method: 'get', url: path, data: null, params: params, headers: {'x-json-params': true}})
                .success(function(result) {
                    if(Object.prototype.toString.call(result) === '[object Array]') {
                        if(result.length > 0) {
                            if(result[0]._type && $injector.get(result[0]._type + 'Model')) {
                                defer.resolve($injector.get(result[0]._type + 'Model').parseResult(result, path));
                            }
                            else {
                                defer.resolve(result);
                            }
                        }
                        else {
                            defer.resolve([]);
                        }
                    }
                    else {
                        if(result._type && $injector.get(result[0]._type + 'Model')) {
                            defer.resolve($injector.get(result[0]._type + 'Model').parseResult(result, path));
                        }
                        else {
                            defer.resolve(result);
                        }
                    }
                })
                .error(function(data, statusCode) {
                    var error = new FireError(data);
                    error.number = statusCode;
                    defer.reject(error);
                });

            return defer.promise;
        };
        {{/isHasMethod}}
        {{/methods}}
    };
}]);
{{/models}}

app.service('FireModels', [function() {
    throw new Error('FireModels service is deprecated.');
}]);
