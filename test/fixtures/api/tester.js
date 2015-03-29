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


app.post('/api/testers', function(app, response, request, TesterModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = TesterModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = request.body || {};

						if(typeof canCreate == 'object') {
							createMap = merge(createMap, canCreate);
						}

						if(TesterModel.options.automaticPropertyName) {
							if(createMap[TesterModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[TesterModel.options.automaticPropertyName] = authenticator;
						}

						if(_canSetProperties(Object.keys(createMap), TesterModel)) {
							return TesterModel.create(createMap);
						}
						else {
							var error = new Error('Bad Request');
							error.status = 400;
							throw error;
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/testers', function(request, response, app,  TesterModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = TesterModel.getAccessControl();
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

						if(TesterModel.options.automaticPropertyName) {
							queryMap[TesterModel.options.automaticPropertyName] = authenticator;
						}

						return TesterModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/testers/:id', function(request, response, app,  TesterModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = TesterModel.getAccessControl();
			return Q.all([accessControl.canRead({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead) {
				var whereMap = request.query || {};
				whereMap.id = request.param('id');

				if(typeof canRead == 'object') {
					whereMap = merge(whereMap, canRead);
				}

				if(TesterModel.options.automaticPropertyName) {
					whereMap[TesterModel.options.automaticPropertyName] = authenticator;
				}

				return TesterModel.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/testers/:id', function(request, response, app,  TesterModel, UserModel) {
	var accessControl = TesterModel.getAccessControl();
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

				if(TesterModel.options.automaticPropertyName) {
					whereMap[TesterModel.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.param('id');
				return [_canUpdateProperties(Object.keys(request.body), TesterModel), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([TesterModel.updateOne(whereMap, request.body), authenticator]);
			}
			else {
				var error = new Error();
				error.status = 400;
				error.message = 'Bad Request';
				throw error;
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

app.delete('/api/testers', function(request, response, app,  TesterModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = TesterModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete) {
						var whereMap = request.query || {};

						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						if(TesterModel.options.automaticPropertyName) {
							whereMap[TesterModel.options.automaticPropertyName] = authenticator;
						}

						return TesterModel.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/testers/:id', function(request, response, app,  TesterModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = TesterModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete) {
					var whereMap = request.query || {};

					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					whereMap.id = request.param('id');

					if(TesterModel.options.automaticPropertyName) {
						whereMap[TesterModel.options.automaticPropertyName] = authenticator;
					}

					return TesterModel.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});
































