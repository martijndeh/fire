'use strict';

exports = module.exports = Controller;

var Router = require('./router');
var Template = require('./template');
var Q = require('q');

/**
 * The base constructor for a controller. Inheritance is applied when calling App#controller on a controller constructor.
 *
 * To prevent leaking of data between requests, for every request a new instance is allocated and initialized. This is likely to change in the future because of optimizations.
 *
 * @api private
 *
 * @param {Models} models   The models module.
 * @param {http.IncomingMessage} request  The HTTP request from express.
 * @param {http.ServerResponse} response The HTTP response from
 *
 * @property {Array} basePathComponents	The base path or prefix of every route in this controller. For example, a basePathComponents of `['api', 'v1']` would prefix every route with `/api/v1`.
 * @property {Models} models	The models module. On the models module you can access the models. For more information see Models.
 * @property {express.cookie-session} session	Cookie-based session storage, see {@link https://github.com/expressjs/cookie-session}.
 * @property {Dictionary} body 	The HTTP request's body.
 * @property {Dictionary} query The HTTP request's query parameters.
 * @property {http.IncomingMessage} __request	The HTTP request. The request is currently available, but it's likely in the future this property will be deprecated and removed.
 * @property {http.ServerResponse} __response	The HTTP response. See Controller#__request.
 *
 * @constructor
 */
function Controller(models, request, response) {
	// This needs some re-work. Ideally we have a Controller which manages ControllerInstance types (which are used during every request).
	// Now it's a bit awkward if we want to get e.g. the router of a Controller.

	this.models = models;

	this.session = request.session;

	this.body = {};
	this.query = {};

	var self = this;
	Object.keys(request.body).forEach(function(key) {
		try {
			self.body[key] = JSON.parse(request.body[key]);
		}
		catch(e) {
			//
		}
	});

	Object.keys(request.query).forEach(function(key) {
		try {
			self.query[key] = JSON.parse(request.query[key]);
		}
		catch(e) {
			//
		}
	});

	this.basePathComponents = [];

	this.__request = request;
	this.__response = response;
}

/**
 * Returns the value of the request's route parameter, body or query. This is a convenience method. See {@link http://expressjs.com/4x/api.html#req.param}.
 *
 * @param  {String} name The name of the parameter.
 * @return {Mixed}
 */
Controller.prototype.param = function(name) {
	return this.__request.param(name);
};

/**
 * Creates and returns a router. The router is responsible for creating the routes of the controller.
 *
 * If you want to override the default router behaviour of your controller(s), override this method and return a custom router. See Router for more information on how to override the router.
 *
 * This method is not invoked on an instance, but rather, the method is retrieved from the controller constructor's prototype. `this` may be undefined. Do not use it.
 *
 * @this undefined
 *
 * @param {Constructor} controllerConstructor The controller's constructor.
 * @param {String} filePath              The path to the controller's file. The default router sets Controller#basePathComponents based on subdirectories the controller's file is located in.
 * @return {Router} The newly created router.
 */
Controller.prototype.getRouter = function(controllerConstructor, filePath) {
	// The router creates the actually routes to the controller.
	return new Router(controllerConstructor, filePath);
};

/**
 * Returns a template to render. This should only be used in view routes. For more information on templates, see Templates.
 *
 * @param  {String} templateName    The name of the template, for example, index.jade.
 * @param  {Dictionary} templateOptions Optionally any template options.
 * @return {Template}                 The template.
 */
Controller.prototype.template = function(templateName, templateOptions) {
	return new Template(templateName, templateOptions);
};

// The below should be excluded from auto-route generations.

/**
 * The before method is executed before any matching request is routed to the controller. You typically overwrite this method to perform any actions before any request is routed to the controller.
 *
 * You may return a promise and the system continues once the promise resolves or rejects.
 *
 */
Controller.prototype.before = function() {};

/**
 * The after method is executed after any matching request is routed to the controller. You, similar to Controller#before, typically overwrite this method to perform any tasks after any requests matching the controller finished.
 *
 * This method is executed after the response has been send to the client. It's not possible to change the response to the client from this method. This behaviour might change in the future.
 */
Controller.prototype.after = function() {};

/**
 * This method is executed right after your controller gets allocated right before a request. The first parameter to this request is the value of `process.env.NODE_ENV` or 'development'.
 */
Controller.prototype.configure = function() {};

/**
 * This method returns the current authenticated authenticator instance, for example, the currently signed in user.
 *
 * An authenticator is configured via the Models~PropertyType#Authenticate property type. See Models for more information.
 *
 * This method does not cache the return value.
 */
Controller.prototype.findAuthenticator = function() {
	var authenticatorModel = this.models.getAuthenticator();

	if(!authenticatorModel) {
		return Q.when(null);
	}

	return authenticatorModel.findOne({accessToken:this.session.at});
};

/*
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

Controller.prototype.createModel = function(model, createMap) {

};

Controller.prototype.findModel = function(model, id) {

};

Controller.prototype.findModels = function(model, findMap) {

};

Controller.prototype.updateModel = function(model, id, updateMap) {

};

Controller.prototype.deleteModel = function(model, id) {

};

Controller.prototype.canCreateModel = function(model) {
	var accessControl = model.getAccessControl();

	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canCreate(authenticator))
				.then(function(canCreate) {
					if(canCreate) {
						return true;
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

Controller.prototype.canReadModel = function(model) {
	var accessControl = model.getAccessControl();

	return this.findAuthenticator()
		.then(function(authenticator) {
			// TODO: We should also check the key path.

			return Q.when(accessControl.canRead(authenticator))
				.then(function(canRead) {
					if(canRead) {
						return true;
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

Controller.prototype.canUpdateModel = function(model) {
	var accessControl = model.getAccessControl();

	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.getPermissionFunction('update')(authenticator))
				.then(function(canUpdate) {
					if(canUpdate) {
						return true;
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

Controller.prototype.canDeleteModel = function(model) {
	var accessControl = model.getAccessControl();

	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.getPermissionFunction('delete')(authenticator))
				.then(function(canDelete) {
					if(canDelete) {
						return true;
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};
*/
