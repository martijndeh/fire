'use strict';

var Q = require('q');
var app = require('./..').app('test');

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

// TODO: Move this to a shared location. In the model or access control?
function _canUpdateProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && typeof property.options.canUpdate != 'undefined' && property.options.canUpdate !== true) {
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


app.post('/api/containers', function(app, response, request, ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canCreate(app, {authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate === true) {
						var createMap = request.body || {};
						if(ContainerModel.options.automaticPropertyName) {
							if(createMap[ContainerModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[ContainerModel.options.automaticPropertyName] = authenticator;
						}

						return ContainerModel.create(createMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/containers', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canRead(app, {authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead === true) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						if(ContainerModel.options.automaticPropertyName) {
							queryMap[ContainerModel.options.automaticPropertyName] = authenticator;
						}

						return ContainerModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/containers/:id', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.all([accessControl.canRead(app, {authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead === true) {
				var whereMap = request.query || {};
				whereMap.id = request.param('id');

				if(ContainerModel.options.automaticPropertyName) {
					whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
				}

				return ContainerModel.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/containers/:id', function(request, response, app,  ContainerModel, UserModel) {
	var accessControl = ContainerModel.getAccessControl();
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
					if(!ContainerModel.getProperty(keyPath)) {
						throw new Error('Invalid key path `' + keyPath + '`.');
					}

					whereMap[keyPath] = authenticator;
				}

				if(ContainerModel.options.automaticPropertyName) {
					whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.param('id');
				return [_canUpdateProperties(Object.keys(request.body), ContainerModel), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([ContainerModel.updateOne(whereMap, request.body), authenticator]);
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

app.delete('/api/containers', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete === true) {
						var whereMap = request.query || {};

						var keyPath = accessControl.getPermissionKeyPath('delete');
						if(keyPath) {
							if(!ContainerModel.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							whereMap[keyPath] = authenticator;
						}

						if(ContainerModel.options.automaticPropertyName) {
							whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
						}

						return ContainerModel.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/containers/:id', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete === true) {
					var whereMap = request.query || {};

					whereMap.id = request.param('id');

					var keyPath = accessControl.getPermissionKeyPath('delete');
					if(keyPath) {
						if(!ContainerModel.getProperty(keyPath)) {
							throw new Error('Invalid key path `' + keyPath + '`.');
						}

						whereMap[keyPath] = authenticator;
					}

					if(ContainerModel.options.automaticPropertyName) {
						whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
					}

					return ContainerModel.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});













app.post('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	// TODO: Add accessControl

	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var property = ContainerModel.getProperty('users');
			return Q.all([typeof property.options.canCreate != 'undefined' ? app.injector.call(property.options.canCreate, {request: request, response: response, authenticator: authenticator}) : true, authenticator]);
		})
		.spread(function(canCreate, authenticator) {
			if(canCreate !== true) {
				throw unauthenticatedError(authenticator);
			}
			else {
				return authenticator;
			}
		})
		.then(function(authenticator) {
			var association = ContainerModel.getAssociation('users');
			var associatedModel = association.getAssociatedModel();

			var createMap = request.body || {};

			var property = ContainerModel.getProperty('users');
			createMap[property.options.hasMany] = request.param('id');

			if(associatedModel.options.automaticPropertyName) {
				if(createMap[associatedModel.options.automaticPropertyName]) {
					var error = new Error('Cannot set automatic property manually.');
					error.status = 400;
					throw error;
				}

				createMap[associatedModel.options.automaticPropertyName] = authenticator;
			}

			return associatedModel.create(createMap);
		});
});

app.get('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canRead(app, {authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead === true) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						var association = ContainerModel.getProperty('users');
						var associatedModel = association.options.relationshipVia.model;

						queryMap[association.options.relationshipVia.name] = request.param('id');

						if(associatedModel.options.automaticPropertyName) {
							if(queryMap[associatedModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							queryMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						return associatedModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/containers/:id/users/:associationID', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.all([app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete !== true) {
				throw unauthenticatedError(authenticator);
			}
			else {
				var association = ContainerModel.getProperty('users');
				var associatedModel = association.getAssociatedModel();

				var removeMap = {};
				removeMap[association.options.hasMany] = request.param('id');
				removeMap.id = request.param('associationID');

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName]) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				var queryMap = request.query || {};
				var optionsMap = {};

				if(queryMap.$options) {
					optionsMap = queryMap.$options;
					delete queryMap.$options;
				}

				return associatedModel.removeOne(removeMap, optionsMap);
			}
		});
});

app.delete('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.all([app.injector.call(accessControl.getPermissionFunction('delete'), {authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete !== true) {
				throw unauthenticatedError(authenticator);
			}
			else {
				var association = ContainerModel.getProperty('users');
				var associatedModel = association.getAssociatedModel();

				var removeMap = request.query || {};
				removeMap[association.options.hasMany] = request.param('id');

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName]) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				var optionsMap = {};

				if(removeMap.$options) {
					optionsMap = removeMap.$options;
					delete removeMap.$options;
				}

				return associatedModel.remove(removeMap, optionsMap);
			}
		});
});

app.put('/api/containers/:id/users/:associationID', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(app.injector.call(accessControl.getPermissionFunction('update'), {authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						var association = ContainerModel.getProperty('users');
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), association.options.relationshipVia.model))
							.then(function(canUpdateProperties) {
								var error;
								if(canUpdateProperties) {
									var whereMap = {};

									var keyPath = accessControl.getPermissionKeyPath('update');
									if(keyPath) {
										if(!ContainerModel.getProperty(keyPath)) {
											throw new Error('Invalid key path `' + keyPath + '`.');
										}

										whereMap[keyPath] = authenticator;
									}

									whereMap[association.options.relationshipVia.name] = request.param('id');
									whereMap.id = request.param('associationID');

									var associatedModel = association.options.relationshipVia.model;
									if(associatedModel.options.automaticPropertyName) {
										// This is definitely a bad request if the user tries to set the automatic property manually.
										if(whereMap[associatedModel.options.automaticPropertyName]) {
											error = new Error('Cannot set automatic property manually.');
											error.status = 400;
											throw error;
										}

										whereMap[associatedModel.options.automaticPropertyName] = authenticator;
									}

									return associatedModel.updateOne(whereMap, request.body);
								}
								else {
									error = new Error();
									error.status = 400;
									error.message = 'Bad Request';
									throw error;
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});


