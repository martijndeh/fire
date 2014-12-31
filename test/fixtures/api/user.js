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


UserModelController.prototype.getMe = ['/api/users/me', function() {
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

UserModelController.prototype.doSignOut = ['/api/users/sign-out', function() {
	this.session.at = null;
	return {};
}];

UserModelController.prototype.doAuthorize = ['/api/users/authorize', function() {
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

UserModelController.prototype.doForgotPassword = ['/api/users/forgot-password', function() {
	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		if(authenticator) {
			var error = new Error('Forbidden');
			error.status = 403;
			throw error;
		}
	})
	.then(function() {
		var findMap = {
			email: self.body.email
		};

		return self.models.User.findOne(findMap);
	})
	.then(function(authenticator) {
		if(authenticator) {
			return Q.all([authenticator, self.models.UserResetPassword.findOrCreate({authenticator: authenticator})])
			.spread(function(authenticator, resetPassword) {
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
}];

UserModelController.prototype.doResetPassword = ['/api/users/reset-password', function() {
	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		if(authenticator) {
			var error = new Error('Forbidden');
			error.status = 403;
			throw error;
		}
	})
	.then(function() {
		return self.models.UserResetPassword.getOne({
			token: self.body.resetToken
		});
	})
	.then(function(resetPassword) {
		return Q.all([self.models.User.updateOne({id: resetPassword.authenticator}, {password: self.body.password}), self.models.UserResetPassword.remove({id: resetPassword.id})]);
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

UserModelController.prototype.getUser = function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	// TODO: Use Controller#canCreate.

	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.all([Q.when(accessControl.canRead(authenticator)), authenticator]);
	})
	.spread(function(canRead, authenticator) {
		if(canRead) {
			var whereMap = {id: id};

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

UserModelController.prototype.updateUser = function(id) {
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

			whereMap.id = id;
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

UserModelController.prototype.deleteUsers = function() {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.getPermissionFunction('delete')(authenticator))
		.then(function(canDelete) {
			if(canDelete) {
				var whereMap = self.query || {};

				var keyPath = accessControl.getPermissionKeyPath('delete');
				if(keyPath) {
					if(!model.getProperty(keyPath)) {
						throw new Error('Invalid key path `' + keyPath + '`.');
					}

					whereMap[keyPath] = authenticator;
				}

				if(model.options.automaticPropertyName) {
					whereMap[model.options.automaticPropertyName] = authenticator;
				}

				return model.remove(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
	});
};

UserModelController.prototype.deleteUser = function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.getPermissionFunction('delete')(authenticator))
		.then(function(canDelete) {
			if(canDelete) {
				var whereMap = {
					id: id
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














UserModelController.prototype.createResetpassword = ['/api/users/:id/reset-password', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		var property = model.getProperty('resetPassword');
		return Q.all([Q.when(typeof property.options.canCreate != 'undefined' ? property.options.canCreate.call(self, id, authenticator) : function(){return true;}), authenticator]);
	})
	.spread(function(canCreate, authenticator) {
		if(!canCreate) {
			throw unauthenticatedError(authenticator);
		}
		else {
			return authenticator;
		}
	})
	.then(function(authenticator) {
		var createMap = self.body;

		var property = model.getProperty('resetPassword');
		var associatedModel = property.getAssociatedModel();

		createMap[property.options.hasOne || property.options.belongsTo] = id;

		if(associatedModel.options.automaticPropertyName) {
			// If a authenticator model does not exists there is some wrong.
			if(!self.models.getAuthenticator()) {
				throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
			}

			// This is definitely a bad request if the user tries to set the automatic property manually.
			if(createMap[associatedModel.options.automaticPropertyName]) {
				var error = new Error('Cannot set automatic property manually.');
				error.status = 400;
				throw error;
			}

			createMap[associatedModel.options.automaticPropertyName] = authenticator;
		}

		return associatedModel.create(createMap);
	});
}];

UserModelController.prototype.getResetpassword = ['/api/users/:id/reset-password', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.canRead(authenticator))
		.then(function(canRead) {
			if(canRead) {
				var queryMap = self.query || {};
				var optionsMap = {};

				if(queryMap.$options) {
					optionsMap = queryMap.$options;
					delete queryMap.$options;
				}

				var association = model.getProperty('resetPassword');
				var associatedModel = association.options.relationshipVia.model;

				queryMap[association.options.relationshipVia.name] = id;

				if(associatedModel.options.automaticPropertyName) {
					if(!self.models.getAuthenticator()) {
						throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
					}

					if(queryMap[associatedModel.options.automaticPropertyName]) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					queryMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				return associatedModel.findOne(queryMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
	});
}];

UserModelController.prototype.deleteResetpassword = ['/api/users/:id/reset-password', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.all([Q.when(accessControl.getPermissionFunction('delete')(authenticator)), authenticator]);
	})
	.spread(function(canDelete, authenticator) {
		if(!canDelete) {
			throw unauthenticatedError(authenticator);
		}
		else {
			var association = model.getProperty('resetPassword');
			var associatedModel = association.getAssociatedModel();

			var removeMap = {};
			removeMap[association.options.hasOne || association.options.belongsTo] = id;

			if(associatedModel.options.automaticPropertyName) {
				// If a authenticator model does not exists there is some wrong.
				if(!self.models.getAuthenticator()) {
					throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
				}

				// This is definitely a bad request if the user tries to set the automatic property manually.
				if(removeMap[associatedModel.options.automaticPropertyName]) {
					var error = new Error('Cannot set automatic property manually.');
					error.status = 400;
					throw error;
				}

				removeMap[associatedModel.options.automaticPropertyName] = authenticator;
			}

			var queryMap = self.query || {};
			var optionsMap = {};

			if(queryMap.$options) {
				optionsMap = queryMap.$options;
				delete queryMap.$options;
			}

			return associatedModel.removeOne(removeMap, optionsMap);
		}
	});
}];

UserModelController.prototype.updateResetpassword = ['/api/users/:id/reset-password', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.getPermissionFunction('update')(authenticator))
		.then(function(canUpdate) {
			if(canUpdate) {
				var association = model.getProperty('resetPassword');
				return Q.when(_canUpdateProperties(Object.keys(self.body), association.options.relationshipVia.model))
				.then(function(canUpdateProperties) {
					if(canUpdateProperties) {
						var associatedModel = association.getAssociatedModel();

						var whereMap = {};

						var keyPath = accessControl.getPermissionKeyPath('update');
						if(keyPath) {
							if(!model.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							whereMap[keyPath] = authenticator;
						}

						whereMap[association.options.hasOne || association.options.belongsTo] = id;

						if(associatedModel.options.automaticPropertyName) {
							// If a authenticator model does not exists there is some wrong.
							if(!self.models.getAuthenticator()) {
								throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
							}

							// This is definitely a bad request if the user tries to set the automatic property manually.
							if(whereMap[associatedModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							whereMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						return associatedModel.updateOne(whereMap, self.body);
					}
					else {
						var error = new Error();
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
}];
















UserModelController.prototype.createContainer = ['/api/users/:id/container', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		var property = model.getProperty('container');
		return Q.all([Q.when(typeof property.options.canCreate != 'undefined' ? property.options.canCreate.call(self, id, authenticator) : function(){return true;}), authenticator]);
	})
	.spread(function(canCreate, authenticator) {
		if(!canCreate) {
			throw unauthenticatedError(authenticator);
		}
		else {
			return authenticator;
		}
	})
	.then(function(authenticator) {
		var createMap = self.body;

		var property = model.getProperty('container');
		var associatedModel = property.getAssociatedModel();

		createMap[property.options.hasOne || property.options.belongsTo] = id;

		if(associatedModel.options.automaticPropertyName) {
			// If a authenticator model does not exists there is some wrong.
			if(!self.models.getAuthenticator()) {
				throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
			}

			// This is definitely a bad request if the user tries to set the automatic property manually.
			if(createMap[associatedModel.options.automaticPropertyName]) {
				var error = new Error('Cannot set automatic property manually.');
				error.status = 400;
				throw error;
			}

			createMap[associatedModel.options.automaticPropertyName] = authenticator;
		}

		return associatedModel.create(createMap);
	});
}];

UserModelController.prototype.getContainer = ['/api/users/:id/container', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.canRead(authenticator))
		.then(function(canRead) {
			if(canRead) {
				var queryMap = self.query || {};
				var optionsMap = {};

				if(queryMap.$options) {
					optionsMap = queryMap.$options;
					delete queryMap.$options;
				}

				var association = model.getProperty('container');
				var associatedModel = association.options.relationshipVia.model;

				queryMap[association.options.relationshipVia.name] = id;

				if(associatedModel.options.automaticPropertyName) {
					if(!self.models.getAuthenticator()) {
						throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
					}

					if(queryMap[associatedModel.options.automaticPropertyName]) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					queryMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				return associatedModel.findOne(queryMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
	});
}];

UserModelController.prototype.deleteContainer = ['/api/users/:id/container', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.all([Q.when(accessControl.getPermissionFunction('delete')(authenticator)), authenticator]);
	})
	.spread(function(canDelete, authenticator) {
		if(!canDelete) {
			throw unauthenticatedError(authenticator);
		}
		else {
			var association = model.getProperty('container');
			var associatedModel = association.getAssociatedModel();

			var removeMap = {};
			removeMap[association.options.hasOne || association.options.belongsTo] = id;

			if(associatedModel.options.automaticPropertyName) {
				// If a authenticator model does not exists there is some wrong.
				if(!self.models.getAuthenticator()) {
					throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
				}

				// This is definitely a bad request if the user tries to set the automatic property manually.
				if(removeMap[associatedModel.options.automaticPropertyName]) {
					var error = new Error('Cannot set automatic property manually.');
					error.status = 400;
					throw error;
				}

				removeMap[associatedModel.options.automaticPropertyName] = authenticator;
			}

			var queryMap = self.query || {};
			var optionsMap = {};

			if(queryMap.$options) {
				optionsMap = queryMap.$options;
				delete queryMap.$options;
			}

			return associatedModel.removeOne(removeMap, optionsMap);
		}
	});
}];

UserModelController.prototype.updateContainer = ['/api/users/:id/container', function(id) {
	var model = this.models.User;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
	.then(function(authenticator) {
		return Q.when(accessControl.getPermissionFunction('update')(authenticator))
		.then(function(canUpdate) {
			if(canUpdate) {
				var association = model.getProperty('container');
				return Q.when(_canUpdateProperties(Object.keys(self.body), association.options.relationshipVia.model))
				.then(function(canUpdateProperties) {
					if(canUpdateProperties) {
						var associatedModel = association.getAssociatedModel();

						var whereMap = {};

						var keyPath = accessControl.getPermissionKeyPath('update');
						if(keyPath) {
							if(!model.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							whereMap[keyPath] = authenticator;
						}

						whereMap[association.options.hasOne || association.options.belongsTo] = id;

						if(associatedModel.options.automaticPropertyName) {
							// If a authenticator model does not exists there is some wrong.
							if(!self.models.getAuthenticator()) {
								throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
							}

							// This is definitely a bad request if the user tries to set the automatic property manually.
							if(whereMap[associatedModel.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							whereMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						return associatedModel.updateOne(whereMap, self.body);
					}
					else {
						var error = new Error();
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
}];




