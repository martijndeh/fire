var Controllers = require('./controllers');
var Models = require('./models');
var Views = require('./views');
var Middlewares = require('./middlewares');
var Responders = require('./responders');
var Workers = require('./workers');

var Q = require('q');

exports = module.exports = App;

function App() {
	this.workers = new Workers();

	this.models = new Models(this.workers);
	this.views = new Views();
	this.controllers = new Controllers();

	this.middlewares = new Middlewares();
	this.responders = new Responders();
}

/*
App.prototype.getRoute = function(connection) {
	return this.controllers.getRoute(connection);
}
*/

App.prototype.createController = function(route) {
	var controllerClass = route.caller.constructor;
	var controller = new controllerClass();
	controller.clone(route.caller);
	return controller;
}

App.prototype.parseResponse = function(response) {
	//todo: if it's an object, and not a promise directly, loop through it
	return Q(response)
		.then(function(result) {
			return result;
		})
}

App.prototype.parseConnection = function(connection) {
	var route = this.controllers.getRoute(connection);

	if(!route) {
		//responders handle a connection and do not pass anything to controllers
		//at this point, middlewares aren't called prior to a responder--middlewares only pass data to a controller
		//the first matching responder parses the connection--not all responders
		this.responders.parseConnection(connection)
			.then(function(response) {
				connection.sendResponse(response);
			})
			.fail(function(error) {
				if(!error) {
					error = new Error('Not Found');
					error.status = 404;
				}

				connection.sendError(error);
			});
	}
	else {
		//just to be sure--we copy the controller so there is no shared data in there at all
		var controller = this.createController(route);
		controller.connection = connection;

		//we have an action--so let's call all middlewares
		//middlewares pass data to controllers
		this.middlewares.parseConnection(connection, controller)
			.then(function() {
				// TODO: should we somehow cache this
				if(typeof controller.before == 'function') {
					return Q.when(controller.before());
				}
				else {
					return true;
				}
			})
			.then(function() {
				return Q.when(route.method.apply(controller, Array.prototype.slice.call(route.matches, 1)));
			})
			.then(function(response) {
				return this.middlewares.sendConnection(connection, controller).then(function() {
					return response;
				});
			}.bind(this))
			.then(function(response) {
				var view = this.views.getView(route);
				return view.render(response);
			}.bind(this))
			.then(function(response) {
				connection.sendResponse(response);
			})
			.fail(function(error) {
				connection.sendError(error);
			})
			.done();
	}
}
