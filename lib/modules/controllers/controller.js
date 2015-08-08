'use strict';

exports = module.exports = Controller;

var utils = require('./../../helpers/utils');
var Q = require('q');
//var debug = require('debug')('fire:controller');

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
 * This allows you to set the `resolve` in `$routeProvider` of the controller. For example:
 *
 * ```
 * TodoController.prototype.resolve = function() {
 * 	return {
 * 		list: function(TodoListModel, _StorageService) {
 * 			if(_StorageService.get('list')) {
 * 				return TodoListModel.findOne({id: _StorageService.get('list')});
 * 			}
 * 			else {
 * 				return TodoListModel.create({}).then(function(list) {
 * 					_StorageService.set('list', list.id);
 * 					return list;
 * 				});
 * 			}
 * 		}
 * 	};
 * };
 * ```
 */
Controller.prototype.resolve = function() {};

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
