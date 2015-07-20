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

app.get('/api/user-models/me', function(request, UserModelModel, UserModelLoginTokenModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			if(authenticator) {
				request.session.save();
				return authenticator;
			}
			else {
				if(request.query.t) {
					var expireDate = new Date();
					expireDate.setDate(expireDate.getDate() - 14);

					return UserModelLoginTokenModel.findOne({token: request.query.t, createdAt:{$gt: expireDate}})
						.then(function(loginToken) {
							if(loginToken) {
								return UserModelModel.getOne({id: loginToken.authenticator})
									.then(function(authenticator) {
										request.session.at = authenticator.accessToken;
										return authenticator;
									});
							}
							else {
								throw unauthenticatedError(null);
							}
						});
				}
				else {
					throw unauthenticatedError(null);
				}
			}
		});
});

app.delete('/api/user-models/access-token', function(request, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			if(authenticator) {
				request.session.at = null;
				authenticator.accessToken = null;
				return authenticator.save();
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.then(function() {
			return {};
		});
});


app.post('/api/user-models/access-token', function(request, UserModelModel) {
	return UserModelModel.authorize({ email: request.body.email, password: request.body.password})
		.then(function(modelInstance) {
			request.session.at = modelInstance.accessToken;
			return modelInstance;
		});
});

app.put('/api/user-models/password', function(request, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			return authenticator.changePassword(request.body.currentPassword, request.body.newPassword, request.body.confirmPassword);
		})
		.then(function(authenticator) {
			request.session.at = authenticator.accessToken;
			return {};
		})
		.catch(function(error) {
			error.status = 404;
			throw error;
		});
});

app.delete('/api/user-models/password', function(request, UserModelModel, UserModelResetPasswordModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			if(authenticator && request.body.email != authenticator['email']) {
				var error = new Error('Forbidden');
				error.status = 403;
				throw error;
			}
		})
		.then(function() {
			return UserModelModel.forgotPassword(request.body.email);
		});
});

app.post('/api/user-models/password', function(request, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function() {
			return UserModelModel.resetPassword(request.body.resetToken, request.body.newPassword, request.body.confirmPassword);
		})
		.then(function(authenticator) {
			request.session.at = authenticator.accessToken;
			return authenticator;
		});
});



app.post('/api/user-models', function(app, response, request, UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var checkCreateMap = function(createMap) {
							if(typeof canCreate == 'object') {
								createMap = merge(createMap, canCreate);
							}

							if(UserModelModel.options.automaticPropertyName) {
								createMap[UserModelModel.options.automaticPropertyName] = authenticator;
							}



							if(_canSetProperties(Object.keys(createMap), UserModelModel)) {
								return createMap;
							}
							else {
								throw badRequestError();
							}
						};

						if(Array.isArray(request.body)) {
							
							var error = badRequestError();
							error.message = 'Cannot create multiple authenticator models.';
							throw error;
						}
						else {
							return UserModelModel.create(checkCreateMap(request.body || {}), {authenticator: authenticator, request: request, response: response})
								.then(function(modelInstance) {
									request.session.at = modelInstance.accessToken;
									return modelInstance;
								});
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/user-models/_count', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			var propertyName = null;



			if(whereMap.$options) {
				propertyName = whereMap.$options.propertyName;
				delete whereMap.$options;
			}

			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return UserModelModel.count(propertyName, whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/user-models', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}
			optionsMap.isShallow = true;

			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return UserModelModel.find(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/user-models/:id', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			whereMap.id = request.params.id;

			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
			}

			optionsMap.isShallow = true;

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return UserModelModel.getOne(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.put('/api/user-models/:id', function(request, response, app,  UserModelModel) {
	var accessControl = UserModelModel.getAccessControl();
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			whereMap.id = request.params.id;

			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						if(typeof canUpdate == 'object') {
							whereMap = merge(whereMap, canUpdate);
						}

						return [_canUpdateProperties(Object.keys(request.body), UserModelModel), whereMap, authenticator];
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([UserModelModel.updateOne(whereMap, request.body), authenticator]);
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

app.put('/api/user-models', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};

			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), UserModelModel))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									return UserModelModel.update(whereMap, request.body || {});
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

app.delete('/api/user-models', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = null;
			if(whereMap.$options) {
                optionsMap = whereMap.$options;
                delete whereMap.$options;
            }

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canDelete) {
					if(canDelete) {
						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						return UserModelModel.remove(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/user-models/:id', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var whereMap = request.query || {};
			whereMap.id = request.params.id;
			if(UserModelModel.options.automaticPropertyName) {
				whereMap[UserModelModel.options.automaticPropertyName] = authenticator;
			}

			var optionsMap = null;
			if(whereMap.$options) {
                optionsMap = whereMap.$options;
                delete whereMap.$options;
            }

			var accessControl = UserModelModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
			.then(function(canDelete) {
				if(canDelete) {
					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					return UserModelModel.removeOne(whereMap, optionsMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});







app.post('/api/user-models/:id/password-reset', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var property = UserModelModel.getProperty('passwordReset');
			return Q.all([
				typeof property.options.canCreate != 'undefined' ? app.injector.call(property.options.canCreate, {request: request, response: response, authenticator: authenticator}) : true,
				authenticator
			]);
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
			var property = UserModelModel.getProperty('passwordReset');
			var associatedModel = property.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = request.body || {};

						if(typeof canCreate == 'object') {
							createMap = merge(createMap, canCreate);
						}

						createMap[property.options.hasOne || property.options.belongsTo] = request.params.id;

						if(associatedModel.options.automaticPropertyName) {
							// This is definitely a bad request if the user tries to set the automatic property manually.
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

app.get('/api/user-models/:id/password-reset', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var association = UserModelModel.getProperty('passwordReset');
			var associatedModel = association.options.relationshipVia.model;

			var whereMap = request.query || {};
			var optionsMap = {};

			if(whereMap.$options) {
				optionsMap = whereMap.$options;
				delete whereMap.$options;
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

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canRead) {
					if(canRead) {
						if(typeof canRead == 'object') {
							whereMap = merge(whereMap, canRead);
						}

						return associatedModel.findOne(whereMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/user-models/:id/password-reset', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var association = UserModelModel.getProperty('passwordReset');
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

				var association = UserModelModel.getProperty('passwordReset');
				var associatedModel = association.getAssociatedModel();

				removeMap[association.options.hasOne || association.options.belongsTo] = request.params.id;

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName] && removeMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
						throw badRequestError();
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				var optionsMap = {};

				if(removeMap.$options) {
					optionsMap = removeMap.$options;
					delete removeMap.$options;
				}

				return associatedModel.removeOne(removeMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/user-models/:id/password-reset', function(request, response, app,  UserModelModel) {
	return findAuthenticator(UserModelModel, request)
		.then(function(authenticator) {
			var association = UserModelModel.getProperty('passwordReset');
			var associatedModel = association.getAssociatedModel();

			var whereMap = request.query || {};

			whereMap[association.options.hasOne || association.options.belongsTo] = request.params.id;

			if(associatedModel.options.automaticPropertyName) {
				if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
					var error = new Error('Cannot set automatic property manually.');
					error.status = 400;
					throw error;
				}

				whereMap[associatedModel.options.automaticPropertyName] = authenticator;
			}

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response, whereMap: whereMap}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), association.options.relationshipVia.model))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									return associatedModel.updateOne(whereMap, request.body || {});
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
























