'use strict';

exports = module.exports = Controllers;

var util = require('util');
var Controller = require('./controller');
var Resources = require('./resources');

var url = require('url');
var utils = require('./utils');

function Controllers() {
	Resources.call(this);

	this.routes = [];
}
util.inherits(Controllers, Resources);

Controllers.prototype.load = function(fullPath, models) {
	var controllerClass = require(fullPath);

	this.loadClass(controllerClass, fullPath, models);
}

Controllers.prototype.addController = function(ControllerClass, path) {
	throw new Error('not implemented yet');
}

Controllers.prototype.loadClass = function(ControllerClass, fullPath, models) {
	utils.setupHooks(ControllerClass, ControllerClass.prototype.hooks || []);

	for(var methodName in Controller.prototype) {
		if(Controller.prototype[methodName]) {
			ControllerClass.prototype[methodName] = Controller.prototype[methodName];
		}
	}

	var controller = new ControllerClass();
	Controller.call(controller, fullPath, models);

	this.routes = this.routes.concat(controller.createRoutes());

	return controller;
};

Controllers.prototype.getRoute = function(connection) {
	var verb = connection.request.method.toLowerCase();
	var headers = connection.request.headers;
	var path = url.parse(connection.request.url).pathname;

	for(var i = 0, il = this.routes.length; i < il; i++) {
		var route = this.routes[i];

		var newRoute = route.match(verb, path, headers);
		if(newRoute) {
			return newRoute;
		}
	}

	return null;
}
