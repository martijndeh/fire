exports = module.exports = Controllers;

var util = require('util');
var Controller = require('./controller');
var Resources = require('./resources');

var url = require('url');

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

Controllers.prototype.loadClass = function(controllerClass, fullPath, models) {
	//todo: replace below with actual inheritance
	for(var method in Controller.prototype) {
		//let's check if there indeed is something
		//a trick we use for the Controller#render is setting it to null so it doesn't get seen as a route
		if(Controller.prototype[method]) {
			controllerClass.prototype[method] = Controller.prototype[method];
		}
	}

	var controller = new controllerClass();
	Controller.call(controller, fullPath, models);

	this.routes = this.routes.concat(controller.createRoutes());
}

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
