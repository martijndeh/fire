'use strict';

var Q = require('q');

var fire = require('fire');
var app = fire.app('test');

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


app.post('/api/model-in-app2s', function(app, response, request, ModelInApp2Model, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ModelInApp2Model.getAccessControl();
			return Q.when(accessControl.canCreate(app, {authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate === true) {
						var createMap = request.body || {};
						if(ModelInApp2Model.options.automaticPropertyName) {
							if(createMap[ModelInApp2Model.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
						}

						if(_canSetProperties(Object.keys(createMap), ModelInApp2Model)) {
							return ModelInApp2Model.create(createMap);
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

app.get('/api/model-in-app2s', function(request, response, app,  ModelInApp2Model, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ModelInApp2Model.getAccessControl();
			return Q.when(accessControl.canRead(app, {authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead === true) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						if(ModelInApp2Model.options.automaticPropertyName) {
							queryMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
						}

						return ModelInApp2Model.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/model-in-app2s/:id', function(request, response, app,  ModelInApp2Model, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ModelInApp2Model.getAccessControl();
			return Q.all([accessControl.canRead(app, {authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead === true) {
				var whereMap = request.query || {};
				whereMap.id = request.param('id');

				if(ModelInApp2Model.options.automaticPropertyName) {
					whereMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
				}

				return ModelInApp2Model.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/model-in-app2s/:id', function(request, response, app,  ModelInApp2Model, UserModel) {
	var accessControl = ModelInApp2Model.getAccessControl();
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var keyPath = accessControl.getPermissionKeyPath('update');
			return Q.all([keyPath ? true : app.injector.call(accessControl.getPermissionFunction('update'), {authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canUpdate, authenticator) {
			if(canUpdate) {
				var whereMap = request.query || {};

				var keyPath = accessControl.getPermissionKeyPath('update');
				if(keyPath) {
					if(!ModelInApp2Model.getProperty(keyPath)) {
						throw new Error('Invalid key path `' + keyPath + '`.');
					}

					whereMap[keyPath] = authenticator;
				}

				if(ModelInApp2Model.options.automaticPropertyName) {
					whereMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.param('id');
				return [_canUpdateProperties(Object.keys(request.body), ModelInApp2Model), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([ModelInApp2Model.updateOne(whereMap, request.body), authenticator]);
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

app.delete('/api/model-in-app2s', function(request, response, app,  ModelInApp2Model, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ModelInApp2Model.getAccessControl();
			return Q.when(app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete === true) {
						var whereMap = request.query || {};

						var keyPath = accessControl.getPermissionKeyPath('delete');
						if(keyPath) {
							if(!ModelInApp2Model.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							whereMap[keyPath] = authenticator;
						}

						if(ModelInApp2Model.options.automaticPropertyName) {
							whereMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
						}

						return ModelInApp2Model.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/model-in-app2s/:id', function(request, response, app,  ModelInApp2Model, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ModelInApp2Model.getAccessControl();
			return Q.when(app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete === true) {
					var whereMap = request.query || {};

					whereMap.id = request.param('id');

					var keyPath = accessControl.getPermissionKeyPath('delete');
					if(keyPath) {
						if(!ModelInApp2Model.getProperty(keyPath)) {
							throw new Error('Invalid key path `' + keyPath + '`.');
						}

						whereMap[keyPath] = authenticator;
					}

					if(ModelInApp2Model.options.automaticPropertyName) {
						whereMap[ModelInApp2Model.options.automaticPropertyName] = authenticator;
					}

					return ModelInApp2Model.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});










