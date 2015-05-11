'use strict';

var Q = require('q');

var fire = require('./..');
var app = fire.app('test');

function merge(dest, source) {
	Object.keys(source).forEach(function(key) {
		dest[key] = source[key];
	});
	return dest;
}

function unauthenticatedError(authenticator) {
	var error = new Error();

	if(authenticator) {
		error.status = 403;
		error.message = 'Forbidden';
	}
	else {
		error.status = 401;
		error.message = 'Unauthorized';
	}

	return error;
}

function badRequestError() {
	var error = new Error();
	error.status = 400;
	error.message = 'Bad Request';
	return error;
}

function _canUpdateProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && (typeof property.options.canUpdate != 'undefined' && property.options.canUpdate !== true || typeof property.options.canSet != 'undefined' && property.options.canSet !== true)) {
			return false;
		}
	}

	return true;
}

function _canSetProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && typeof property.options.canSet != 'undefined' && property.options.canSet !== true) {
			return false;
		}
	}

	return true;
}

function findAuthenticator(authenticatorModel, request) {
	if(!authenticatorModel) {
		return Q.when(null);
	}

	var credentials = null;
	if(request.headers.authorization && request.headers.authorization.length > 6) {
		credentials = (new Buffer(request.headers.authorization.substring(6), 'base64')).toString('utf8').split(':');

		if(!credentials.length) {
			credentials = null;
		}
		else if(credentials.length == 1) {
			credentials.push('');
		}
	}

	if(credentials) {
		var findMap = {};
		findMap[authenticatorModel.options.authenticatingProperty.name] = credentials[0];
		findMap.accessToken = credentials[1];
		return authenticatorModel.findOne(findMap);
	}

	if(!request.session.at) {
		return Q.when(null);
	}

	return authenticatorModel.findOne({accessToken: request.session.at});
}


app.post('/api/collections', function(app, response, request, CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var checkCreateMap = function(createMap) {
							if(typeof canCreate == 'object') {
								createMap = merge(createMap, canCreate);
							}

							if(CollectionModel.options.automaticPropertyName) {
								createMap[CollectionModel.options.automaticPropertyName] = authenticator;
							}

							if(_canSetProperties(Object.keys(createMap), CollectionModel)) {
								return createMap;
							}
							else {
								throw badRequestError();
							}
						};

						if(Array.isArray(request.body)) {
							

							var createMaps = request.body.map(function(createMap) {
								return checkCreateMap(createMap);
							});

							return CollectionModel.create(createMaps);
							
						}
						else {
							return CollectionModel.create(checkCreateMap(request.body || {}));
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/collections', function(request, response, app,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(typeof canRead == 'object') {
							queryMap = merge(queryMap, canRead);
						}

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						optionsMap.isShallow = true;

						if(CollectionModel.options.automaticPropertyName) {
							queryMap[CollectionModel.options.automaticPropertyName] = authenticator;
						}

						return CollectionModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/collections/:id', function(request, response, app,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.all([accessControl.canRead({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead) {
				var whereMap = request.query || {};
				whereMap.id = request.params.id;

				if(typeof canRead == 'object') {
					whereMap = merge(whereMap, canRead);
				}

				if(CollectionModel.options.automaticPropertyName) {
					whereMap[CollectionModel.options.automaticPropertyName] = authenticator;
				}

				var optionsMap = {};

				if(whereMap.$options) {
					optionsMap = whereMap.$options;
					delete whereMap.$options;
				}

				optionsMap.isShallow = true;

				return CollectionModel.getOne(whereMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/collections/:id', function(request, response, app,  CollectionModel, UserModel) {
	var accessControl = CollectionModel.getAccessControl();
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			return Q.all([accessControl.canUpdate({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canUpdate, authenticator) {
			if(canUpdate) {
				var whereMap = request.query || {};

				if(typeof canUpdate == 'object') {
					whereMap = merge(whereMap, canUpdate);
				}

				if(CollectionModel.options.automaticPropertyName) {
					whereMap[CollectionModel.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.params.id;
				return [_canUpdateProperties(Object.keys(request.body), CollectionModel), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([CollectionModel.updateOne(whereMap, request.body), authenticator]);
			}
			else {
				throw badRequestError();
			}
		})
		.spread(function(modelInstance, authenticator) {
			if(modelInstance) {
				return modelInstance;
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.catch(function(error) {
			throw error;
		});
});

app.put('/api/collections', function(request, response, app,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), CollectionModel))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									var whereMap = request.query || {};

									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									if(CollectionModel.options.automaticPropertyName) {
										whereMap[CollectionModel.options.automaticPropertyName] = authenticator;
									}

									return CollectionModel.update(whereMap, request.body || {});
								}
								else {
									throw badRequestError();
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/collections', function(request, response, app,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete) {
						var whereMap = request.query || {};

						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						if(CollectionModel.options.automaticPropertyName) {
							whereMap[CollectionModel.options.automaticPropertyName] = authenticator;
						}

						return CollectionModel.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/collections/:id', function(request, response, app,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete) {
					var whereMap = request.query || {};

					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					whereMap.id = request.params.id;

					if(CollectionModel.options.automaticPropertyName) {
						whereMap[CollectionModel.options.automaticPropertyName] = authenticator;
					}

					return CollectionModel.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});








app.get('/api/collections/:id/apps', function(app, request, response,  CollectionModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = CollectionModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead === true) {
						var property = CollectionModel.getProperty('apps');
						return app.injector.call(property.options.hasMethod, {request: request, response: response, authenticator: authenticator});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});





