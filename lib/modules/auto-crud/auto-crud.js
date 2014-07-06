'use strict';

exports = module.exports = AutoCrud;

var fire = require('./../../firestarter');
var inflection = require('inflection');
var Q = require('q');

var debug = require('debug')('fire:auto-crud');

function AutoCrud(app) {
	this.app = app;
}

AutoCrud.prototype.setup = function() {
	debug('Setup auto-crud routes');

	var self = this;
	this.app.models.forEach(function(model, modelName) {
		self.createRoute(modelName, model);
	});
};

AutoCrud.prototype.addModel = function(modelName, model) {
	return this.createRoute(modelName, model);
};

AutoCrud.prototype.createRoute = function(modelName, model) {
	debug('Create route `' + modelName + '`.');

	var pluralName = inflection.pluralize(modelName);

	// TODO: Use a default controller and change paths with the Router.

	var ModelController = function() {};
	ModelController.name = modelName + 'ModelController';
	fire.controller(ModelController);

	ModelController.prototype.basePathComponents = ['api'];

	if(this.app.models.getAuthenticator()) {
		// TODO: Maybe we should not query our authenticator _every_ request?
		ModelController.prototype.configure = function() {
			debug('Configuring controller.');

			this._authenticator = null;
		};

		ModelController.prototype.before = function() {
			debug('ModelController#before.');
			debug(this.session.at);

			var self = this;
			return this.models.getAuthenticator()
				.findOne({accessToken:this.session.at})
				.then(function(authenticator) {
					debug('Setting authenticator');

					self._authenticator = authenticator;
				});
		};
	}

	ModelController.prototype['get' + pluralName] = function() {
		return this.models[modelName].find(this.query);
	};

	ModelController.prototype['update' + modelName] = function($id) {
		function _canUpdateProperties(propertyNames) {
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

		var accessControl = model.getAccessControl();

		var self = this;
		return Q.when(accessControl.getPermissionFunction('update')(this._authenticator))
			.then(function(canUpdate) {
				if(canUpdate) {
					var whereMap = {};

					var keyPath = accessControl.getPermissionKeyPath('update');
					if(keyPath) {
						if(!model.getProperty(keyPath)) {
							throw new Error('Invalid key path `' + keyPath + '`.');
						}

						// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
						whereMap[keyPath] = self._authenticator;
					}

					whereMap.id = $id;

					// Now check if we may update the properties we want to update.
					return Q.when(_canUpdateProperties(Object.keys(self.body)))
						.then(function(canUpdateProperties) {
							if(canUpdateProperties) {
								return self.models[modelName].update(whereMap, self.body)
									.then(function(instance) {
										if(instance) {
											return instance;
										}
										else {
											var error = new Error();

											if(self._authenticator) {
												error.status = 403;
												error.message = 'Forbidden';
											}
											else {
												error.status = 401;
												error.message = 'Unauthorized';
											}

											throw error;
										}
									});
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
					console.log('Cannot update');

					var error = new Error();

					if(self._authenticator) {
						error.status = 403;
						error.message = 'Forbidden';
					}
					else {
						error.status = 401;
						error.message = 'Unauthorized';
					}

					throw error;
				}
			})
			.catch(function(error) {
				console.log(error);

				throw error;
			});
	};

	ModelController.prototype['get' + modelName] = function($id) {
		return this.models[modelName].getOne({id: $id});
	};

	// Create an instance of the model.
	// This check the access control if it's allowed to be created.
	// If an authenticator is created, it's access token is set to the session.
	// If an automatic property exists, it's set to the authenticator.
	ModelController.prototype['create' + modelName] = function() {
		var accessControl = model.getAccessControl();

		debug('Create ' + modelName);

		var self = this;
		return Q.when(accessControl.canCreate(this._authenticator))
			.then(function(canCreate) {
				debug('Can create ' + modelName + ': ' + canCreate);

				if(canCreate) {
					if(model.options.automaticPropertyName) {
						debug('Setting automatic property.');

						if(!self.models.getAuthenticator()) {
							throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
						}

						self.body[model.options.automaticPropertyName] = self._authenticator;
					}

					return model.create(self.body)
						.then(function(instance) {
							if(model.isAuthenticator()) {
								self.session.at = instance.accessToken;
							}

							return instance;
						});
				}
				else {
					var error = new Error();

					if(self._authenticator) {
						error.status = 403;
						error.message = 'Forbidden';
					}
					else {
						error.status = 401;
						error.message = 'Unauthorized';
					}

					throw error;
				}
			})
			.catch(function(error) {
				console.log(error);

				throw error;
			});
	};

	ModelController.prototype.deleteModel = function($id) { //jshint ignore:line
		throw new Error('Not implemented');
	};

	if(model.isAuthenticator()) {
		var AuthorizeController = function AuthorizeController() {};
		fire.controller(AuthorizeController);

		AuthorizeController.prototype.basePathComponents = ['api'];

		AuthorizeController.prototype.doAuthorize = function() {
			debug('doAuthorize');

			// TODO: What if we're already authorized? Should we somehow disallow this? If so, we need a deauthorize method as well.

			var map = {};
			map[model.options.authenticatingProperty.name] = this.body[model.options.authenticatingProperty.name];

			// TODO: Do not hard code this property like this.
			map.password = this.body.password;

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
		};
	}
};
