'use strict';

exports = module.exports = Controller;

var Router = require('./router');
var Template = require('./template');
var utils = require('./../../helpers/utils');
var Q = require('q');
var debug = require('debug')('fire:controller');

/**
 * The base constructor of a controller. Inheritance is applied when calling {@link App#controller} on a controller constructor. Do not call this constructor yourself (unless you know what you are doing).
 *
 * To prevent leaking of data between requests, for every request a new instance is allocated and initialized. This is likely to change in the future because of optimizations.
 *
 * @param {Models} models   The models module.
 * @param {Workers} workers	The workers module.
 * @param {http.IncomingMessage} request  The HTTP request from express.
 * @param {http.ServerResponse} response The HTTP response from express.
 *
 * @property {Array} basePathComponents	The base path or prefix of every route in this controller. A `basePathComponents` of `['api', 'v1']` would prefix every route with `/api/v1`.
 *
 * The below example creates a controller which returns all users when calling `/api/v1/users`.
 * ```js
 * function MyController() {
 * 	// This is executed in the local context.
 * }
 * app.controller(MyController);
 *
 * MyController.prototype.basePathComponents = ['api', 'v1'];
 *
 * MyController.prototype.getUsers = function() {
 * 	return [];
 * };
 * ```
 *
 * @property {Models} models	The models instance. This exposes all models registered via {@link App#model}.
 *
 * In a controller method, in the server-context, you can access e.g. a `User` model via the following:
 * ```js
 * MyController.prototype.getUser = function(id) {
 * 	return this.models.User.findOne({id: id});
 * };
 * ```
 *
 * In a controller, in the client-context, you can access the models via the `fire` service:
 * ```
 * function MyController($scope, UserModel) {
 * 	UserModel.findOne({name: 'Martijn'})
 * 		.then(function(user) {
 * 			// Do something with `user`.
 * 		})
 * }
 * app.controller(MyController);
 * ```
 *
 * @property {express.cookie-session} session	Cookie-based session storage. The session is initialized when a controller is constructed. The `SESSION_KEYS` environmental variable is used as keys to sign the cookie, see {@link https://github.com/expressjs/cookie-session} for more information.
 * @property {Dictionary} body 	The HTTP request's body.
 * @property {Dictionary} query The HTTP request's query parameters.
 * @property {http.IncomingMessage} __request	The HTTP request.
 * @property {http.ServerResponse} __response	The HTTP response.
 *
 * @constructor
 */
function Controller(models, workers, request, response) {
	// This needs some re-work. Ideally we have a Controller which manages ControllerInstance types (which are used during every request).
	// Now it's a bit awkward if we want to get e.g. the router of a Controller.

	this.models = models;
	this.workers = workers;

	this.session = request.session;

	this.body = request.body;
	this.query = request.query;

	this.headers = request.headers;


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
 * Creates and returns a router. The router is responsible for creating the routes of the controller. For example, if you have a method named `getUser(id)` on your controller, the router creates the HTTP route to it, in the default router's case `GET /users/:id`.
 *
 * If you want to override the default router behaviour of your controller(s), override this method and return a custom router. See {@link Router
} for more information on how to override the router.
 *
 * This method is not invoked on an instance, but rather, the method is retrieved from the controller constructor's prototype. `this` will be undefined when this method is invoked. Do not rely on it.
 *
 * @this undefined
 * @access private
 *
 * @param {Constructor} controllerConstructor The controller's constructor. The default router loops over this constructor's prototype to build the  routes for every method.
 * @param {String} filePath              The path to the controller's file. The default router sets {@link Controller#basePathComponents} based on subdirectories the controller's file is located in. For example, if your controller is saved in a file at `controllers/api/controller.js` the `basePathComponents` is set to `['api']`.
 * @return {Router} The newly created router.
 */
Controller.prototype.getRouter = function(controllerConstructor, filePath) {
	// The router creates the actually routes to the controller.
	return new Router(controllerConstructor, filePath);
};

/**
 * Returns a template to render. This should only be used in view routes.
 *
 * A view route is created by prefixing the method name with `view`, like the below.
 * ```
 * MyController.prototype.viewTest = function() {
 * 	return this.template('user.jade');
 * };
 * ```
 *
 * This creates a route in the local-context angular `$routeProvider`, creates a `templateUrl` to `GET /templates/user.jade` and makes sure direct access to `GET /test` also works. For more information on routes, see {@link Router}.
 *
 * For more information on templates and how to declare them, see {@link Templates}.
 *
 * @param  {String} templateName    The name of the template, for example, index.jade.
 * @param  {Dictionary} templateOptions Optionally any template options passed to the template renderer.
 * @return {Template}                 The template.
 */
Controller.prototype.template = function(templateName, templateOptions) {
	return new Template(templateName, templateOptions);
};

/**
 * The page of the controller. The page contains the main view, which is the initial html used to render and includes the `ngView` directive.
 *
 * By default, `view.jade` is set as the main template.
 */
Controller.prototype.page = function() {
	return {
		scripts: [],
		styles: []
	};
};

/**
 * You may overwrite this method.
 *
 * The before method is executed before any matching request is routed to the controller. You typically overwrite this method to perform any actions before any request is routed to the controller.
 *
 * The below example creates a `before` method which gets executed before the `getTests` is executed:
 * ```
 * function MyController() {
 * 	// This is run in the client-context.
 * }
 * app.controller(MyController);
 *
 * MyController.prototype.before = function() {
 * 	// Do something before every method.
 * };
 *
 * MyController.prototype.getTests = function() {
 * 	return [];
 * };
 * ```
 *
 * If you return a promise, the flow is only resumed when you resolve the promise. If you reject the promise, an error is returned.
 *
 */
Controller.prototype.before = function() {};

/**
 * You may overwrite this method.
 *
 * The after method is executed after any matching request is routed to the controller and is successful. You typically overwrite this method to perform any tasks after any requests matching the controller succeeded.
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
 * The authenticator is either retrieved from the session, if the `at` property is set, or from the Authorization header, if Basic base64 (authenticating property:access token) is set.
 *
 * An authenticator is configured via the {@link PropertyTypes#Authenticate} property type.
 *
 * This method does not cache the return value.
 */
Controller.prototype.findAuthenticator = function() {
	var authenticatorModel = this.models.getAuthenticator();
	if(!authenticatorModel) {
		return Q.when(null);
	}

	var credentials = utils.parseAuthorization(this.headers.authorization);
	if(credentials) {
		var findMap = {};
		findMap[authenticatorModel.options.authenticatingProperty.name] = credentials[0];
		findMap.accessToken = credentials[1];
		return authenticatorModel.findOne(findMap);
	}

	if(!this.session.at) {
		return Q.when(null);
	}

	return authenticatorModel.findOne({accessToken:this.session.at});
};
