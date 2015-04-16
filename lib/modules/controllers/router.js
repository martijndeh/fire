'use strict';

exports = module.exports = Router;

var path = require('path');
var inflection = require('inflection');
var util = require('util');

var Controller = require('./controller');
var Route = require('./route');

var config = require('./../../helpers/config');
var utils = require('./../../helpers/utils');


var debug = require('debug')('fire:router');

var Template = require('./template');

function getBasePathComponents(filePath) {
	var paths = [];

	// `filePath` is the path to the file of the controller. It's optional.
	if(filePath) {
		// We strip the local path up till controllers (we immediately try to make it work on non-*nix).
		paths = path.dirname(filePath.substring(config.basePath.length + (path.sep + 'controllers').length))
			.split(path.sep)
			.filter(function(pathPart) {
				return pathPart.length;
			});
	}

	return paths;
}

function isRESTMethod(methodName) {
	return !((methodName.indexOf('view') === 0 || methodName.indexOf('do') === 0));
}

function getVerb(action) {
	var transformMap = {
		'create': 'post',
		'update': 'put',

		'view': 'get',
		'do': 'post'
	};

	return transformMap[action] || action;
}

function getPath(verb, method, methodName, basePath) {
	// TODO: Maybe this should be more in express-style also so we can re-use it in the client-side?!
	var remotePath = '';

	basePath.forEach(function(_) {
		remotePath += '/' + _;
	});

	var nameWithoutVerb = utils.captureOne(methodName, /^[a-z]+(.*)$/);
	if(nameWithoutVerb && nameWithoutVerb.length) {
		// If the method is a RESTful call, we pluralize the names.
		// If it's not a RESTful call, e.g. a verb-based call (RPCish), we leave the name as-is.
		if(isRESTMethod(methodName)) {
			remotePath += '/' + inflection.transform(nameWithoutVerb, ['tableize', 'dasherize']);
		}
		else {
			remotePath += '/' + inflection.transform(nameWithoutVerb, ['dasherize']).toLowerCase();
		}
	}

	var args = utils.getMethodArgumentNames(method);
	args.forEach(function(arg) {
		if(arg.length && arg[0] == '$') {
			throw new Error('Starting argument names with `$` is no longer neccesary. Please remove the $ in `' + methodName + '` argument `' + arg + '`.');
		}

		remotePath += '/:' + arg;
	});

	// If nothing is specified in the path yet, make sure it's at least /.
	if(remotePath.length === 0) {
		remotePath += '/';
	}

	return remotePath;
}


/**
 * The router is responsible for creating routes. The created routes are passed to the delegate, either a Controller instance, or another module, like Bridge.
 *
 * For example, a controller creates a router, the controller is set as the router's delegate, and the controller executes the Router#createRoutes. Whenever the router creates a route, the delegate#addRoute is invoked.
 *
 * A controller is not the only module utilizing the router. The Bridge module, and in the future more modules, are using the router to find all routes.
 *
 * To customize the routing behaviour, and if the array-based notation is not sufficient, overwrite your controller's Controller#getRouter method and return a custom router.
 *
 * @property delegate {Mixed} The router's delegate. Whenever a route is created, the {@link Route} instance is passed to the delegate via `addRoute(route)` method.
 *
 * @param {Constructor} controllerConstructor The controller to create the routes for.
 * @param {String} filePath              The file path to the controller. If the controller is included in a subdirectory in `controllers/` and {@link Controller#basePathComponents} is not set, the subdirectory is prepended to all route paths.
 * @constructor
 */
function Router(controllerConstructor, filePath) {
	// Router is used by the Controllers module and the Bridge module.
	// Perhaps we should move it to it's own module?

	this.delegate = null;
	this.controllerConstructor = controllerConstructor;

	if(controllerConstructor.prototype.basePathComponents) {
		this.basePathComponents = controllerConstructor.prototype.basePathComponents;
	}
	else {
		this.basePathComponents = getBasePathComponents(filePath) || [];
	}
}

/**
 * Loops over the controller's prototype and checks whether a route should be created for any of the properties.
 *
 * Currently, the following rules must apply:
 * 	1. The property's name must not be declared on the base constructor's (Controller's) prototype. For example, Controller#configure and Controller#before.
 * 	2. The property's name most not start with _ (underscore). Methods prefixed with _ are excluded from the routes.
 * 	3. The property must either be a method, or an array equal to [{Mixed}, {Function}].
 */
Router.prototype.createRoutes = function() {
	// TODO: Deprecate these route methods.

	//debug('createRoutes ' + this.controllerConstructor.name);

	var routeName;
	for(routeName in this.controllerConstructor.prototype) {
		//debug('Checking method ' + routeName);

		// Route is either a method, or an array with a string and a method.
		var route = this.controllerConstructor.prototype[routeName];
		if(routeName.length && typeof Controller.prototype[routeName] == 'undefined' && routeName[0] != '_' && (typeof route == 'function' || util.isArray(route) && route.length == 2 && typeof route[1] == 'function')) {
			this.createRoute(routeName);
		}
		else {
			//debug('Not creating route for `' + routeName + '`.');
		}
	}
};

/**
 * Creates a route for the given name and passes it to the delegate.
 *
 * The routes action is determined by the first word of the route name. The route's action is translated to the route's HTTP verb. If the action is one of the below, the HTTP verb becomes:
 *
 * 	create	POST
 * 	update	PUT
 * 	view	GET
 * 	do 		POST
 *
 * If the action is anything else, it's translated to the HTTP verb 1:1.
 *
 * The path of the route is determined by the remaining words of the route's name. The words are pluralized and dasherized. Then for every argument of the route's method which starts with a $, a route param is appended. A few examples are listed below:
 *
 * ```js
 * ExampleController.prototype.getUsers = function() { ... }; // GET /users
 * ExampleController.prototype.getUser = function($userID) { ... }; // GET /users/:userID -- notice that user gets pluralized.
 * ExampleController.prototype.getChocolateFactory = function() { ... }; // GET /chocolate-factories -- the name also gets dasherized, if neccesary
 * ```
 *
 * If the route's action is `do` or `view`, which is considered not-RESTful, the remaining words of the route's name are not pluralized and dasherized. This is useful when you are writing RPC-based routes, or if you simply write view routes. A few examples are listed below:
 *
 * ```js
 * ExampleController.prototype.view = function() { ... }; // GET /
 * ExampleController.prototype.viewBlog = function() { ... }; // GET /blog -- because the route is view-based, blog does not get pluralized.
 * ```
 *
 * Now, this might not cover all your routing needs. That's why it's possible to, instead of declaring a method on your property, it's possible to declare an array instead. The array contains your route's path as first item, and the method as second item. For example:
 *
 * ```js
 * ExampleController.prototype.getUser = ['/user/:userID', function($userID) { ... }];
 * ExampleController.prototype.getUserBuildings = ['/user/:userID/buildings', function($userID) { ... }];
 * ExampleController.prototype.getUserBuilding = ['/user/:userID/buildings/:buildingID', function($userID, $buildingID) { ... }];
 * ```
 *
 * In the above example you'll notice that the route's HTTP verb is still based on the route's action (the first word of the route).
 *
 * Argument names not prefixed with a $ have a different purpose. These arguments are populated with the request's param of the same name. For example, when doing an HTTP POST to `/users` with email and password in the body:
 *
 * ```js
 * TestController.prototype.createUser = function(email, password) {
 * 	// email and password are populated with the values from the body.
 * };
 * ```
 *
 * This is especially useful when switching from the client-context to the server-context. For example, in your local controller:
 *
 * ```js
 * function TestController($scope, fire) {
 * 	// This could get called in a form: createUser('martijn', 'test');
 * 	$scope.createUser = function(email, password) {
 * 		// A client-context api is available in the fire service.
 * 		// The below does a HTTP post to /users with email and password in the body.
 * 		fire.createUser(email, password)
 * 			.then(function(user) {
 * 				// This is the response from the request. This is executed in the client-context.
 * 			});
 * 	};
 * };
 *
 * TestController.prototype.createUser = function(email, password) {
 * 	// Imagine a user is created here and we return the user...
 * 	return {
 * 		email: email
 * 	};
 * };
 * ```
 *
 * The controller's constructor is executed in the local-context, and the controller methods are executed in the server-context.
 *
 * @param {String} routeName The route's name—which is the name of the property on the controller's prototype.
 */
Router.prototype.createRoute = function(routeName) {
	debug('Creating route for ' + routeName + '.');

	var route = new Route();
	route.action = utils.captureOne(routeName, /^([a-z]+)/);
	route.verb = getVerb(route.action);

	var method = null;
	var routePath = null;

	if(util.isArray(this.controllerConstructor.prototype[routeName])) {
		var routeList = this.controllerConstructor.prototype[routeName];
		routePath 	= routeList[0];
		method 		= routeList[1];
	}
	else {
		method = this.controllerConstructor.prototype[routeName];
		routePath = getPath(route.verb, method, routeName, this.basePathComponents);
	}

	route.methodName = routeName;
	route.method = method;
	route.path = routePath;
	route.pathRegex = routePath.replace(/:([^/]+)/g, '([^/]+)');
	route.controllerConstructor = this.controllerConstructor;
	route.argumentNames = utils.getMethodArgumentNames(method);
	route.isView = (route.action == 'view');

	if(route.isView) {
		route.template = route.method.call({
			template: function(templateName, templateOptions) {
				return new Template(templateName, templateOptions);
			}
		});

		if(!route.template || !(route.template instanceof Template)) {
			throw new Error('View route method `' + route.methodName + '` is not running a valid template.');
		}

		route.templatePath = '/templates/' + route.template.name;
	}

	if(this.delegate) {
		this.delegate.addRoute(route);
	}
};
