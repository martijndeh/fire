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





app.post('/api/containers', function(app, response, request, ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var checkCreateMap = function(createMap) {
							if(typeof canCreate == 'object') {
								createMap = merge(createMap, canCreate);
							}

							if(ContainerModel.options.automaticPropertyName) {
								createMap[ContainerModel.options.automaticPropertyName] = authenticator;
							}



							if(_canSetProperties(Object.keys(createMap), ContainerModel)) {
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

							return ContainerModel.create(createMaps, {authenticator: authenticator, request: request, response: response});
							
						}
						else {
							return ContainerModel.create(checkCreateMap(request.body || {}), {authenticator: authenticator, request: request, response: response});
						}
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
			var whereMap = request.query || {};
			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}
			optionsMap.isShallow = true;

			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return ContainerModel.find(whereMap, optionsMap);
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
			var whereMap = request.query || {};
			whereMap.id = request.params.id;

			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}

			optionsMap.isShallow = true;

			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return ContainerModel.getOne(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.put('/api/containers/:id', function(request, response, app,  ContainerModel, UserModel) {
	var accessControl = ContainerModel.getAccessControl();
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			whereMap.id = request.params.id;

			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						if(typeof canUpdate == 'object') {
							whereMap = merge(whereMap, canUpdate);
						}

						return [_canUpdateProperties(Object.keys(request.body), ContainerModel), whereMap, authenticator];
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([ContainerModel.updateOne(whereMap, request.body), authenticator]);
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

app.put('/api/containers', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), ContainerModel))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									return ContainerModel.update(whereMap, request.body || {});
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

app.delete('/api/containers', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canDelete) {
					if(canDelete) {
						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
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
			var whereMap = request.query || {};
			whereMap.id = request.params.id;
			if(ContainerModel.options.automaticPropertyName) {
				whereMap[ContainerModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = ContainerModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
			.then(function(canDelete) {
				if(canDelete) {
					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
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
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var property = ContainerModel.getProperty('users');
			return Q.all([typeof property.options.canCreate != 'undefined' ? app.injector.call(property.options.canCreate, {request: request, response: response, authenticator: authenticator}) : true, authenticator]);
		})
		.spread(function(canCreate, authenticator) {
			if(typeof canCreate == 'object') {
				throw new Error('PropertyTypes#CanCreate does not support returning an object. Either return true or false. AccessControl#CanCreate supports returning objects.');
			}

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

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = request.body || {};
						createMap[association.options.hasMany] = request.params.id;

						if(typeof canCreate == 'object') {
							createMap = merge(createMap, canCreate);
						}

						if(associatedModel.options.automaticPropertyName) {
							if(createMap[associatedModel.options.automaticPropertyName] && createMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						if(_canSetProperties(Object.keys(createMap), associatedModel)) {
							return associatedModel.create(createMap, {authenticator: authenticator, request: request, response: response});
						}
						else {
							throw badRequestError();
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var association = ContainerModel.getProperty('users');
			var associatedModel = association.options.relationshipVia.model;

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead) {
						var whereMap = request.query || {};
						var optionsMap = {};

						if(whereMap.$options) {
							optionsMap = whereMap.$options;
							delete whereMap.$options;
						}

						optionsMap.isShallow = true;

						var association = ContainerModel.getProperty('users');
						var associatedModel = association.options.relationshipVia.model;

						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						whereMap[association.options.relationshipVia.name] = request.params.id;

						if(associatedModel.options.automaticPropertyName) {
							if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							whereMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						return associatedModel.find(whereMap, optionsMap);
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
			var association = ContainerModel.getProperty('users');
			var associatedModel = association.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();

			return Q.all([accessControl.canDelete({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete) {
				var removeMap = request.query || {};
				var optionsMap = {};

				if(removeMap.$options) {
					optionsMap = removeMap.$options;
					delete removeMap.$options;
				}

				if(typeof canDelete == 'object') {
					removeMap = merge(removeMap, canDelete);
				}

				var association = ContainerModel.getProperty('users');
				var associatedModel = association.getAssociatedModel();

				removeMap[association.options.hasMany] = request.params.id;
				removeMap.id = request.params.associationID;

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName] && removeMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				return associatedModel.removeOne(removeMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.delete('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var association = ContainerModel.getProperty('users');
			var associatedModel = association.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();
			return Q.all([accessControl.canDelete({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete) {
				var removeMap = request.query || {};

				if(typeof canDelete == 'object') {
					removeMap = merge(removeMap, canDelete);
				}

				var association = ContainerModel.getProperty('users');
				var associatedModel = association.getAssociatedModel();

				removeMap[association.options.hasMany] = request.params.id;

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName] && removeMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
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
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/containers/:id/users/:associationID', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var association = ContainerModel.getProperty('users');
			var associatedModel = association.options.relationshipVia.model;

			var whereMap = request.query || {};
			whereMap[association.options.relationshipVia.name] = request.params.id;
			whereMap.id = request.params.associationID;

			if(associatedModel.options.automaticPropertyName) {
				// This is definitely a bad request if the user tries to set the automatic property manually.
				if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
					error = new Error('Cannot set automatic property manually.');
					error.status = 400;
					throw error;
				}

				whereMap[associatedModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), associatedModel))
							.then(function(canUpdateProperties) {
								var error;
								if(canUpdateProperties) {
									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									return associatedModel.updateOne(whereMap, request.body);
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

app.put('/api/containers/:id/users', function(request, response, app,  ContainerModel, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var association = ContainerModel.getProperty('users');
			var associatedModel = association.options.relationshipVia.model;

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), associatedModel))
							.then(function(canUpdateProperties) {
								var error;
								if(canUpdateProperties) {
									var whereMap = request.query || {};
									whereMap[association.options.relationshipVia.name] = request.params.id;

									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									if(associatedModel.options.automaticPropertyName) {
										// This is definitely a bad request if the user tries to set the automatic property manually.
										if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
											error = new Error('Cannot set automatic property manually.');
											error.status = 400;
											throw error;
										}

										whereMap[associatedModel.options.automaticPropertyName] = authenticator;
									}

									return associatedModel.update(whereMap, request.body);
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



