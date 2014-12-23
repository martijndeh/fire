function FireError(message) {
    this.name = 'FireError';
    this.message = message || '';
	this.number = -1;
}
FireError.prototype = new Error();

function FireModelInstance(setMap, model, path) {
	this._map = setMap || {};
	this._changes = {};
	this._model = model;

	if(this._map.id) {
		this._endpoint = path + '/' + this._map.id;
	}
	else {
		this._endpoint = null;
	}
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
    return this.$q.when(Object.keys(this._changes).length)
        .then(function(numberOfChanges) {
            if(numberOfChanges) {
                var queryMap = transformQueryMap(self._changes);

                return self._model._put(self._endpoint, queryMap)
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

FireModel.prototype._action = function(verb, path, params, data) {
	var defer = this.$q.defer();

	var self = this;
	this.$http({method: verb, url: path, data: data, params: params, headers: {'x-json-params': true}})
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

FireModel.prototype._post = function(path, fields) {
	return this._action('post', path, null, this._prepare(fields));
};

FireModel.prototype._get = function(path, params) {
	return this._action('get', path, this._prepare(params));
};

FireModel.prototype._put = function(path, fields) {
	return this._action('put', path, null, this._prepare(fields));
};

FireModel.prototype.update = function(id, model) {
    var queryMap = transformQueryMap(model);

	return this._put(this.endpoint + '/' + id, queryMap);
};

FireModel.prototype.remove = function(modelInstanceOrUUID) {
    var UUID = _getUUID(modelInstanceOrUUID)

	return this._action('delete', this.endpoint + '/' + UUID);
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
    var queryMap = transformQueryMap(fields);

	return this._post(path, queryMap);
};

FireModel.prototype.create = function(fields) {
	return this._create(this.endpoint, fields);
};

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

FireModel.prototype._find = function(path, fields, options) {
	var queryMap = transformQueryMap(fields, options);
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

FireModel.prototype.getOne = function(fields) {
	var defer = this.$q.defer();
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

{{#models}}
function FireModelInstance{{name}}(setMap, model, path) {
	var self = this;
{{#properties}}
	{{#isAssociation}}
	if(typeof setMap.{{name}} != 'undefined' && setMap.{{name}} !== null) {
		if(Array.isArray(setMap.{{name}})) {
			setMap.{{name}} = setMap.{{name}}.map(function(object) {
                return new FireModelInstance{{getAssociatedModelName}}(object, model.models.{{getAssociatedModelName}}, path + '/' + '{{resourceName}}');
			});
		}
		else {
			setMap.{{name}} = new FireModelInstance{{getAssociatedModelName}}(setMap.{{name}}, model.models.{{getAssociatedModelName}}, path + '/' + '{{resourceName}}');
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

	FireModelInstance.call(this, setMap, model, path);
}
FireModelInstance{{name}}.prototype = new FireModelInstance();

{{#methods}}
{{#isOneToOne}}
FireModelInstance{{name}}.prototype.get{{methodName}} = function(queryMap, optionsMap) {
    var self = this;
    return this._model.models.{{modelName}}._find(this._model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap)
        .then(function(modelInstances) {
            if(modelInstances && modelInstances.length) {
                self.{{propertyName}} = modelInstances[0];
                return modelInstances[0];
            }
            else {
                return null;
            }
        });
};

FireModelInstance{{name}}.prototype.create{{methodName}} = function(queryMap) {
    var self = this;
    return this._model.models.{{modelName}}._create(this._model.endpoint + '/' + this.id + '/{{resource}}', queryMap)
        .then(function(modelInstance) {
            self.{{propertyName}} = modelInstance;
            return modelInstance;
        });
};

FireModelInstance{{name}}.prototype.remove{{methodName}} = function() {
    var self = this;
    return this._model.models.{{modelName}}._action('delete', this._model.endpoint + '/' + this.id + '/{{resource}}')
        .then(function(removeModelInstance) {
            self.{{propertyName}} = null;
            return removeModelInstance;
        });
};
{{/isOneToOne}}
{{#isManyToMany}}
FireModelInstance{{name}}.prototype.get{{pluralMethodName}} = function(queryMap, optionsMap) {
    var self = this;
	return this._model.models.{{modelName}}._find(this._model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap)
        .then(function(modelInstances) {
            self.{{propertyName}} = modelInstances;
            return modelInstances;
        })
};

FireModelInstance{{name}}.prototype.create{{singularMethodName}} = function(queryMap) {
    var self = this;
    return this._model.models.{{modelName}}._create(this._model.endpoint + '/' + this.id + '/{{resource}}', queryMap)
        .then(function(createdModelInstance) {
            if(!self.{{propertyName}}) {
                self.{{propertyName}} = [];
            }

            // TODO: How should we sort these associations?
            self.{{propertyName}}.push(createdModelInstance);
            return createdModelInstance;
        });
};

function _getUUID(modelInstanceOrUUID) {
    var UUID;

    if(typeof modelInstanceOrUUID.toQueryValue != 'undefined') {
        UUID = modelInstanceOrUUID.toQueryValue();
    }
    else if(typeof modelInstanceOrUUID.id != 'undefined') {
        UUID = modelInstanceOrUUID.id;
    }
    else {
        if(typeof modelInstanceorUUID != 'string') {
            var error = new FireError('Parameter is not a valid UUID.');
            error.status = 400;
            throw error;
        }

        UUID = modelInstanceOrUUID;
    }

    return UUID;
}

FireModelInstance{{name}}.prototype.remove{{singularMethodName}} = function(modelInstanceOrUUID) {
    var UUID = _getUUID(modelInstanceOrUUID);

    var self = this;
    return this._model.models.{{modelName}}._action('delete', this._model.endpoint + '/' + this.id + '/{{resource}}/' + UUID)
        .then(function(removeModelInstance) {
            for(var i = 0, il = self.{{propertyName}}.length; i < il; i++) {
                var modelInstance = self.{{propertyName}}[i];

                if(modelInstance.id === UUID) {
                    self.{{propertyName}}.splice(i, 1);
                    break;
                }
            }
            return removeModelInstance;
        });
};
{{/isManyToMany}}
{{#isHasMethod}}
FireModelInstance{{name}}.prototype.{{getMethodName}} = function(queryMap, optionsMap) {
    return this._model.models.{{modelName}}._find(this._model.endpoint + '/' + this.id + '/{{resource}}', queryMap, optionsMap);
};
{{/isHasMethod}}
{{/methods}}

function FireModel{{name}}($http, $q, models) {
	FireModel.call(this, $http, $q, models);

	this.endpoint = '/api/{{resource}}';
}
FireModel{{name}}.prototype = new FireModel();

FireModel{{name}}.prototype.parseResult = function(setMapOrList, path) {
	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
		var self = this;
		return setMapOrList.map(function(setMap) {
			return new FireModelInstance{{name}}(setMap, self, path);
		});
	}
	else {
		return new FireModelInstance{{name}}(setMapOrList, this, path);
	}
};

{{#isAuthenticator}}
var __authenticator = null;

FireModel{{name}}.prototype.forgotPassword = function({{authenticatingPropertyName}}) {
	return this._post(this.endpoint + '/forgot-password', { {{authenticatingPropertyName}}: {{authenticatingPropertyName}} });
};

FireModel{{name}}.prototype.resetPassword = function(resetToken, password, confirmPassword) {
	if(password != confirmPassword) {
		var defer = this.$q.defer();
		var error = new FireError('The passwords do not match! Please enter the same password twice.');
		error.number = 400;
		defer.reject(error);
		return defer.promise;
	}

	return this._post(this.endpoint + '/reset-password', {resetToken: resetToken, password: password});
};

FireModel{{name}}.prototype.signOut = function() {
    return this._post(this.endpoint + '/sign-out')
        .then(function() {
            __authenticator = null;
        });
};

FireModel{{name}}.prototype.authorize = function(fields) {
	if(!fields.password || !fields.{{authenticatingPropertyName}}) {
		var defer = this.$q.defer();
		var error = new FireError('Please fill in a {{authenticatingPropertyName}} and password!');
		error.number = 400;
		defer.reject(error);
		return defer.promise;
	}
	else {
		var self = this;
		return this._post(this.endpoint + '/authorize', fields)
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

FireModel{{name}}.prototype.getMe = function() {
	var defer = this.$q.defer();

	if(__authenticator) {
		defer.resolve(__authenticator);
	}
	else {
		var self = this;
		this._get(this.endpoint + '/me')
			.then(function(authenticator) {
				if(authenticator) {
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

app.factory('{{name}}Model', ['$http', '$q', 'FireModels', function($http, $q, FireModels) {
	return new FireModel{{name}}($http, $q, FireModels);
}]);
{{/models}}

// TODO: Remove this in favour of the model factories (which is more angularism).
app.service('FireModels', ['$http', '$q', function($http, $q) {
	{{#models}}
	this.{{name}} = new FireModel{{name}}($http, $q, this);
	{{/models}}
}]);
