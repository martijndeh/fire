'use strict';

exports = module.exports = Controller;

var Router = require('./router');
var Template = require('./template');
var Q = require('q');

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

	this._authenticator = null;

	this.__request = request;
	this.__response = response;
}

Controller.prototype.param = function(name) {
	var value = this.__request.param(name);

	console.log('Controller#param = ' + value);

	return value;
};

Controller.prototype.getRouter = function(controllerConstructor, filePath) {
	// The router creates the actually routes to the controller.
	return new Router(controllerConstructor, filePath);
};

Controller.prototype.template = function(templateName, templateOptions) {
	return new Template(templateName, templateOptions);
};

// The below should be excluded from auto-route generations.

// Before is invoked before an action of a controller gets invoked.
Controller.prototype.before = function() {};

// After is invoked before an action of a controller gets invoked.
Controller.prototype.after = function() {};

// Configure is invoked when the controller gets initialized.
Controller.prototype.configure = function() {};

Controller.prototype.findAuthenticator = function() {
	if(this._authenticator) {
		return Q.when(this._authenticator);
	}
	else {
		var authenticatorModel = this.models.getAuthenticator();

		if(!authenticatorModel) {
			return Q.when(null);
		}

		var self = this;
		return authenticatorModel
			.findOne({accessToken:this.session.at})
			.then(function(authenticator) {
				self._authenticator = authenticator;
				return authenticator;
			});
	}
};
