'use strict';

exports = module.exports = Controller;

var Router = require('./router');
var Template = require('./template');

function Controller(models, request, response) {
	this.models = models;
	this.session = request.session;
	this.body = request.body;
	this.query = request.query;

	this.basePathComponents = [];

	this.__request = request;
	this.__response = response;
}

Controller.prototype.param = function(name) {
	return this.__request.param(name);
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