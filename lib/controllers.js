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

Controllers.prototype.load = function(fullPath, extra) {
	var controllerClass = require(fullPath);

	//todo: replace below with actual inheritance
	for(var method in Controller.prototype) {
		controllerClass.prototype[method] = Controller.prototype[method];
	}

	var controller = new controllerClass();
	Controller.call(controller, fullPath, extra);
	
	this.routes = this.routes.concat(controller._createRoutes());
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