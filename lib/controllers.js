exports = module.exports = Controllers;

var util = require('util');
var Controller = require('./controller');
var Resources = require('./resources');

var url = require('url');
var utils = require('./utils');
var path = require('path');
var config = require('./config');

var Q = require('q');

function Controllers(app) {
	Resources.call(this);

	this.app = app;
}
util.inherits(Controllers, Resources);

Controllers.prototype.load = function(fullPath, models) {
	var controllerConstructor = require(fullPath);

	this.loadClass(controllerConstructor, fullPath, models);
};

Controllers.prototype._setupRoutes = function(fullPath, controllerConstructor) {
	var paths = controllerConstructor.prototype.getBasePath(fullPath);

	// Name of the controller, without ...Controller$.
	var controllerName = controllerConstructor.prototype.getName(controllerConstructor);

	for(var methodName in controllerConstructor.prototype) {
		// If it's a method on the Controller prototype, we assume it's not a public route.
		// If the method starts with a _ we also exclude it from the routes.

		if(methodName.length && typeof Controller.prototype[methodName] == 'undefined' && typeof controllerConstructor.prototype[methodName] == 'function' && methodName[0] != '_') {
			var url = controllerConstructor.prototype.getPath(controllerConstructor.prototype[methodName], paths);
			var verb = controllerConstructor.prototype.getVerb(methodName);
			var viewPath = controllerConstructor.prototype.getViewPath(controllerName, methodName)

			// TODO: Clean this up.
			this.app.addRoute(verb, url, controllerConstructor, controllerConstructor.prototype[methodName], viewPath);
		}
	}
};

Controllers.prototype.loadClass = function(controllerConstructor, fullPath) {
	// Now we add the controller class (it's actually a constructor) to the controllers.
	// This will build the routes to the controller.

	if(!(controllerConstructor.prototype instanceof Controller)) {
		throw new Error('Controller in `' + fullPath + '` is not an instance of Controller. Did you call fire.controller(...) on your controller?');
	}
	else {
		this._setupRoutes(fullPath, controllerConstructor);
		return controllerConstructor;
	}
};