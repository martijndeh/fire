'use strict';

var Q = require('q');

var fire = require('fire');
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

app.get('/api/users/me', function(request, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			if(authenticator) {
				request.session.save();
				return authenticator;
			}
			else {
				var error = new Error('Unauthorized');
				error.status = 401;
				throw error;
			}
		});
});

app.post('/api/users/sign-out', function(request, UserModel) {
	return findAuthenticator(UserModel, request)
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

app.post('/api/users/authorize', function(request, UserModel) {
	return UserModel.getOne({'email': request.body.email })
		.then(function(modelInstance) {
			if(modelInstance.validateHash('password', request.body.password)) {
				return modelInstance;
			}
			else {
				throw new Error('Incorrect password provided.');
			}
		})
		.then(function(modelInstance) {
			request.session.at = modelInstance.accessToken;
			return modelInstance;
		})
		.catch(function(error) {
			throw error;
		});
});

app.post('/api/users/forgot-password', function(request, UserModel, UserResetPasswordModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			if(authenticator) {
				var error = new Error('Forbidden');
				error.status = 403;
				throw error;
			}
		})
		.then(function() {
			var findMap = {
				email: request.body.email
			};

			return UserModel.findOne(findMap);
		})
		.then(function(authenticator) {
			if(authenticator) {
				return UserResetPasswordModel.findOrCreate({authenticator: authenticator})
					.then(function(resetPassword) {
						if(authenticator.onForgotPassword) {
							return authenticator.onForgotPassword.call(authenticator, resetPassword);
						}
					});
			}
		})
		.then(function() {
			// TODO: What should we return other than status code 200?
			return {};
		});
});

app.post('/api/users/reset-password', function(request, UserModel, UserResetPasswordModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			if(authenticator) {
				var error = new Error('Forbidden');
				error.status = 403;
				throw error;
			}
		})
		.then(function() {
			return UserResetPasswordModel.getOne({
				token: request.body.resetToken
			});
		})
		.then(function(resetPassword) {
			return Q.all([
				UserModel.updateOne({id: resetPassword.authenticator}, {password: request.body.password}),
				UserResetPasswordModel.remove({id: resetPassword.id})
			]);
		})
		.spread(function(authenticator) {
			if(authenticator && authenticator.onResetPassword) {
				return authenticator.onResetPassword.call(authenticator);
			}
		})
		.then(function() {
			// TODO: What should we return other than status code 200?
			return {};
		});
});

app.post('/api/users', function(app, response, request, UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = UserModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = request.body || {};

						if(typeof canCreate == 'object') {
							createMap = merge(createMap, canCreate);
						}

						if(UserModel.options.automaticPropertyName) {
							if(createMap[UserModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[UserModel.options.automaticPropertyName] = authenticator;
						}

						if(_canSetProperties(Object.keys(createMap), UserModel)) {
							return UserModel.create(createMap)
								.then(function(modelInstance) {
									request.session.at = modelInstance.accessToken;
									return modelInstance;
								});
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

app.get('/api/users', function(request, response, app,  UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = UserModel.getAccessControl();
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

						if(UserModel.options.automaticPropertyName) {
							queryMap[UserModel.options.automaticPropertyName] = authenticator;
						}

						return UserModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/users/:id', function(request, response, app,  UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = UserModel.getAccessControl();
			return Q.all([accessControl.canRead({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead) {
				var whereMap = request.query || {};
				whereMap.id = request.param('id');

				if(typeof canRead == 'object') {
					whereMap = merge(whereMap, canRead);
				}

				if(UserModel.options.automaticPropertyName) {
					whereMap[UserModel.options.automaticPropertyName] = authenticator;
				}

				return UserModel.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/users/:id', function(request, response, app,  UserModel) {
	var accessControl = UserModel.getAccessControl();
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

				if(UserModel.options.automaticPropertyName) {
					whereMap[UserModel.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.param('id');
				return [_canUpdateProperties(Object.keys(request.body), UserModel), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([UserModel.updateOne(whereMap, request.body), authenticator]);
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

app.delete('/api/users', function(request, response, app,  UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = UserModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete) {
						var whereMap = request.query || {};

						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						if(UserModel.options.automaticPropertyName) {
							whereMap[UserModel.options.automaticPropertyName] = authenticator;
						}

						return UserModel.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/users/:id', function(request, response, app,  UserModel) {
	return findAuthenticator(UserModel, request)
		.then(function(authenticator) {
			var accessControl = UserModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete) {
					var whereMap = request.query || {};

					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					whereMap.id = request.param('id');

					if(UserModel.options.automaticPropertyName) {
						whereMap[UserModel.options.automaticPropertyName] = authenticator;
					}

					return UserModel.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});








