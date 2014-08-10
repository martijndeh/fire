'use strict';

exports = module.exports = API;

var inflection = require('inflection');
var Q = require('q');

var debug = require('debug')('fire:api');

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

/**
 * The API module. This module is responsible for the automatic CRUD API.
 *
 * @api private
 *
 * @param {App} app The app it belongs to.
 * @constructor
 */
function API(app) {
	this.app = app;
}

/**
 * Sets up the API. This method is invoked by the app when App#run is invoked.
 *
 * This methods loops over all models in the app and creates the CRUD actions.
 *
 * @api private
 */
API.prototype.setup = function() {
	debug('Setup API routes');

	var self = this;
	this.app.models.forEach(function(model) {
		self.createRoute(model);
	});
};

/**
 * Creates a route for the given model. All routes start with /api.
 *
 * For example, given the model Test, it creates the following routes:
 *
 * POST /api/tests Create a new Test instance.
 * GET /api/tests/:id Finds an existing Test instance.
 * GET /api/tests Finds a list of Test instances.
 * PUT /api/tests/:id Updates a Test instance.
 * DELETE /api/tests/:id Deletes a Test instance. This action is currently not implemented.
 *
 * If the model is an authenticator (for example a User model), two more routes are created to manage the authorization. Again given a model named Test:
 *
 * POST /api/tests/authorize Authorizes the user with the authenticator property (username or email) and password. If succesful, sets the access token to the cookie.
 * GET /api/tests/me If the user is authorized, retrieves the instance based on the access token set in the cookie.
 *
 * For every association of the model, additional routes are created. Currently, only routes are created for one-to-many assocations. No routes are created for many-to-many or one-to-one assocations. For example, given a Test model with a one-to-many association to Child model, the following routes are created:
 *
 * GET /api/tests/:id/childs Retrieves all Child models from Test.
 * PUT /api/tests/:id/childs/:childID Updates a specific Child model
 *
 * @api private
 *
 * @param {Model} model     The model to create routes for.
 */
API.prototype.createRoute = function(model) {
	var modelName = model.getName();

	debug('Create route `' + modelName + '`.');

	// This is a hack. The properties are no initialized yet.
	model.getAllProperties();

	var pluralName = inflection.pluralize(modelName);

	// TODO: Use a default controller and change paths with the Router.

	var ModelController = function() {};
	ModelController.name = modelName + 'ModelController';
	this.app.controller(ModelController);

	ModelController.prototype.basePathComponents = ['api'];

	var createFunctionName = 'create' + modelName;
	var readFunctionName = 'get' + modelName;
	var readManyFunctionName = 'get' + pluralName;
	var updateFunctionName = 'update' + modelName;
	var deleteFunctionName = 'delete' + modelName;

	if(model.isAuthenticator()) {
		debug('We have an authenticator.');

		ModelController.prototype.getMe = ['/api/' + pluralName + '/me', function() {
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

		ModelController.prototype.doAuthorize = ['/api/' + pluralName + '/authorize', function() {
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
		}];
	}

	ModelController.prototype[readManyFunctionName] = function() {
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

							var readManyFunction = model[readManyFunctionName] || model.find;
							return readManyFunction.call(model, queryMap, optionsMap);
						}
						else {
							throw unauthenticatedError(authenticator);
						}
					});
			});
	};

	ModelController.prototype[updateFunctionName] = function($id) {
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
		return this.findAuthenticator()
			.then(function(authenticator) {
				return Q.when(accessControl.getPermissionFunction('update')(authenticator))
					.then(function(canUpdate) {
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

							// Now check if we may update the properties we want to update.
							return Q.when(_canUpdateProperties(Object.keys(self.body)))
								.then(function(canUpdateProperties) {
									if(canUpdateProperties) {
										var updateFunction = model[updateFunctionName] || model.update;
										return updateFunction.call(model, whereMap, self.body)
											.then(function(instance) {
												if(instance) {
													return instance;
												}
												else {
													throw unauthenticatedError(authenticator);
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
							throw unauthenticatedError(authenticator);
						}
					});
			})
			.catch(function(error) {
				throw error;
			});
	};

	ModelController.prototype[readFunctionName] = function($id) {
		var accessControl = model.getAccessControl();

		return this.findAuthenticator()
			.then(function(authenticator) {
				return Q.when(accessControl.canRead(authenticator))
					.then(function(canRead) {
						if(canRead) {
							var readFunction = model[readFunctionName] || model.getOne;

							// TODO: read should also use all query params as additional where options
							return readFunction.call(model, {id: $id});
						}
						else {
							throw unauthenticatedError(authenticator);
						}
					});
			});
	};

	// Create an instance of the model.
	// This check the access control if it's allowed to be created.
	// If an authenticator is created, it's access token is set to the session.
	// If an automatic property exists, it's set to the authenticator.
	ModelController.prototype[createFunctionName] = function() {
		var accessControl = model.getAccessControl();

		debug('Create ' + modelName);

		var self = this;
		return this.findAuthenticator()
			.then(function(authenticator) {
				return Q.when(accessControl.canCreate(authenticator))
					.then(function(canCreate) {
						debug('Can create ' + modelName + ': ' + canCreate);

						if(canCreate) {
							var createMap = self.body || {};
							if(model.options.automaticPropertyName) {
								debug('Setting automatic property.');

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

							var createFunction = model[createFunctionName] || model.create;

							return createFunction.call(model, self.body)
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

	ModelController.prototype[deleteFunctionName] = function($id) { //jshint ignore:line
		var error = new Error('Not Found');
		error.status = 404;
		throw error;
	};

	var properties = model.getAllProperties();
	Object.keys(properties).forEach(function(propertyName) {
		var property = properties[propertyName];

		if(property.options.isPrivate) {

		}
		else if(property.options.hasMethod) {
			ModelController.prototype['get' + inflection.capitalize(propertyName)] = ['/api/' + pluralName.toLowerCase() + '/:id/' + propertyName, function($id) {
				var accessControl = model.getAccessControl();

				var self = this;
				return this.findAuthenticator()
					.then(function(authenticator) {
						return Q.when(accessControl.canRead(authenticator))
							.then(function(canRead) {
								if(canRead) {
									return property.options.hasMethod.call(self, $id);
								}
								else {
									throw unauthenticatedError(authenticator);
								}
							});
					});
			}];
		}
		else if(property.isAssociation()) {
			var association = property;
			var associationName = propertyName;

			if(association.isManyToMany()) {
				// TODO: Implement many-to-many requests
			}
			else if(association.options.hasMany) {
				ModelController.prototype['get' + inflection.capitalize(associationName)] = ['/api/' + pluralName.toLowerCase() + '/:id/' + associationName, function($id) {
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

										queryMap[association.options.relationshipVia.name] = $id;

										return association.options.relationshipVia.model.find(queryMap, optionsMap);
									}
									else {
										throw unauthenticatedError(authenticator);
									}
								});
						});
				}];

				ModelController.prototype['update' + inflection.capitalize(associationName)] = ['/api/' + pluralName.toLowerCase() + '/:id/' + associationName + '/:associationID', function($id, $associationID) {
					function _canUpdateProperties(propertyNames) {
						for(var i = 0, il = propertyNames.length; i < il; i++) {
							var propertyName = propertyNames[i];
							var property = association.options.relationshipVia.model.getProperty(propertyName);

							// TODO: Implement function-based checks.
							if(property && typeof property.options.canUpdate != 'undefined' && !property.options.canUpdate) {
								return false;
							}
						}

						return true;
					}

					var accessControl = model.getAccessControl();

					var self = this;
					return this.findAuthenticator()
						.then(function(authenticator) {
							return Q.when(accessControl.getPermissionFunction('update')(authenticator))
								.then(function(canUpdate) {
									if(canUpdate) {
										return Q.when(_canUpdateProperties(Object.keys(self.body)))
											.then(function(canUpdateProperties) {
												if(canUpdateProperties) {
													var whereMap = {};

													var keyPath = accessControl.getPermissionKeyPath('update');
													if(keyPath) {
														if(!model.getProperty(keyPath)) {
															throw new Error('Invalid key path `' + keyPath + '`.');
														}

														// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
														whereMap[keyPath] = authenticator;
													}

													whereMap[association.options.relationshipVia.name] = $id;
													whereMap.id = $associationID;

													return association.options.relationshipVia.model.updateOne(whereMap, self.body);
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
			}
			else {
				// TODO: Should we implement this? Probably one a one-to-one association.
			}
		}
	});
};
