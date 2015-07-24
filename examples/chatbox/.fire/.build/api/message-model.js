'use strict';

var Q = require('q');

var fire = require('fire');
var app = fire.app('chatbox');

var http = require('http');

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
	}
	else {
		error.status = 401;
	}

	error.message = http.STATUS_CODES[error.status];
	return error;
}

function badRequestError() {
	var error = new Error();
	error.status = 400;
	error.message = http.STATUS_CODES[error.status];
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





app.post('/api/message-models', function(app, response, request, MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var checkCreateMap = function(createMap) {
							if(typeof canCreate == 'object') {
								createMap = merge(createMap, canCreate);
							}

							if(MessageModelModel.options.automaticPropertyName) {
								createMap[MessageModelModel.options.automaticPropertyName] = authenticator;
							}



							if(_canSetProperties(Object.keys(createMap), MessageModelModel)) {
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

							return MessageModelModel.create(createMaps, {authenticator: authenticator, request: request, response: response});
							
						}
						else {
							return MessageModelModel.create(checkCreateMap(request.body || {}), {authenticator: authenticator, request: request, response: response});
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/message-models/_count', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			var propertyName = null;



			if(whereMap.$options) {
				propertyName = whereMap.$options.propertyName;
				delete whereMap.$options;
			}

			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return MessageModelModel.count(propertyName, whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/message-models', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}
			optionsMap.isShallow = true;

			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return MessageModelModel.find(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/message-models/:id', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			whereMap.id = request.params.id;

			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}

			optionsMap.isShallow = true;

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return MessageModelModel.getOne(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.put('/api/message-models/:id', function(request, response, app,  MessageModelModel, UserModelModel) {
	var accessControl = MessageModelModel.getAccessControl();
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			whereMap.id = request.params.id;

			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						if(typeof canUpdate == 'object') {
							whereMap = merge(whereMap, canUpdate);
						}

						return [_canUpdateProperties(Object.keys(request.body), MessageModelModel), whereMap, authenticator];
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([MessageModelModel.updateOne(whereMap, request.body), authenticator]);
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

app.put('/api/message-models', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), MessageModelModel))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									return MessageModelModel.update(whereMap, request.body || {});
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

app.delete('/api/message-models', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = null;
			if(whereMap.$options) {
                optionsMap = whereMap.$options;
                delete whereMap.$options;
            }

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canDelete) {
					if(canDelete) {
						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						return MessageModelModel.remove(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/message-models/:id', function(request, response, app,  MessageModelModel, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			whereMap.id = request.params.id;
			if(MessageModelModel.options.automaticPropertyName) {
				whereMap[MessageModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = null;
			if(whereMap.$options) {
                optionsMap = whereMap.$options;
                delete whereMap.$options;
            }

			var accessControl = MessageModelModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
			.then(function(canDelete) {
				if(canDelete) {
					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					return MessageModelModel.removeOne(whereMap, optionsMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});


















