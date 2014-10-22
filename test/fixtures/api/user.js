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
		if(property && typeof property.options.canUpdate != 'undefined' && !property.options.canUpdate) {
			return false;
		}
	}

	return true;
}

function UserModelController() {

}
app.controller(UserModelController);

UserModelController.prototype.basePathComponents = ['api'];


UserModelController.prototype.getMe = ['/api/Users/me', function() {
	return this.findAuthenticator()
		.then(function(authenticator) {
			if(authenticator) {
				return authenticator;
			}
			else {
				var error = new Error('Unauthorized');
				error.status = 401;
				throw error;
			}
		});
}];

UserModelController.prototype.doAuthorize = ['/api/Users/authorize', function() {
	// TODO: What if we're already authorized? Should we somehow disallow this? If so, we need a deauthorize method as well.

	var model = this.models.User;
	var map = {
		email: this.body.email,
		password: this.body.password
	};

	var self = this;
	return model.getOne(map)
		.then(function(instance) {
			// TODO: Do not hardcode `accessToken` like this...
			self.session.at = instance.accessToken;
			return instance;
		})
		.catch(function(error) {
			throw error;
		});
}];

UserModelController.prototype.createUser = function() {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	// TODO: Use Controller#canCreate.

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canCreate(authenticator))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = self.body || {};
						if(model.options.automaticPropertyName) {
							// If a authenticator model does not exists there is some wrong.
							if(!self.models.getAuthenticator()) {
								throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
							}

							// This is definitely a bad request if the user tries to set the automatic property manually.
							if(createMap[model.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[model.options.automaticPropertyName] = authenticator;
						}

						return model.create(createMap)
							.then(function(instance) {
								if(model.isAuthenticator()) {
									self.session.at = instance.accessToken;
								}

								return instance;
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

UserModelController.prototype.getUsers = function() {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	// TODO: Use Controller#canRead.

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canRead(authenticator))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = self.query || {};
						var optionsMap = {};

						// TODO: Move this to Model#find instead.

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						if(model.options.automaticPropertyName) {
							queryMap[model.options.automaticPropertyName] = authenticator;
						}

						return model.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

UserModelController.prototype.getUser = function($id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	// TODO: Use Controller#canCreate.

	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.all([Q.when(accessControl.canRead(authenticator)), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead) {
				var whereMap = {id: $id};

				if(model.options.automaticPropertyName) {
					whereMap[model.options.automaticPropertyName] = authenticator;
				}

				return model.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
};

UserModelController.prototype.updateUser = function($id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.all([Q.when(accessControl.getPermissionFunction('update')(authenticator)), authenticator]);
		})
		.spread(function(canUpdate, authenticator) {
			if(canUpdate) {
				var whereMap = {};

				var keyPath = accessControl.getPermissionKeyPath('update');
				if(keyPath) {
					if(!model.getProperty(keyPath)) {
						throw new Error('Invalid key path `' + keyPath + '`.');
					}

					// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
					whereMap[keyPath] = authenticator;
				}

				if(model.options.automaticPropertyName) {
					whereMap[model.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = $id;
				return [Q.when(_canUpdateProperties(Object.keys(self.body), model)), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([model.updateOne(whereMap, self.body), authenticator]);
			}
			else {
				var error = new Error();
				error.status = 400;
				error.message = 'Bad Request';
				throw error;
			}
		})
		.spread(function(instance, authenticator) {
			if(instance) {
				return instance;
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.catch(function(error) {
			throw error;
		});
};

UserModelController.prototype.deleteUser = function($id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.getPermissionFunction('delete')(authenticator))
				.then(function(canDelete) {
					if(canDelete) {
						var whereMap = {
							id: $id
						};

						var keyPath = accessControl.getPermissionKeyPath('delete');
						if(keyPath) {
							if(!model.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
							whereMap[keyPath] = authenticator;
						}

						if(model.options.automaticPropertyName) {
							whereMap[model.options.automaticPropertyName] = authenticator;
						}

						return model.removeOne(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};


















