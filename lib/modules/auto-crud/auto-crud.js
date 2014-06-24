'use strict';

exports = module.exports = AutoCrud;

var fire = require('./../../firestarter');
var inflection = require('inflection');

var debug = require('debug')('fire:auto-crud');

function AutoCrud(app) {
	this.app = app;
}

AutoCrud.prototype.setup = function() {
	debug('Setup');

	var self = this;
	this.app.models.forEach(function(model, modelName) {
		self.createRoute(modelName, model);
	});
};

AutoCrud.prototype.addModel = function(modelName, model) {
	return this.createRoute(modelName, model);
};

AutoCrud.prototype.createRoute = function(modelName, model) {
	debug('Create route `' + modelName + '`.');

	var name = inflection.pluralize(modelName);

	// So we'll create a controller for this model on the fly.
	// TODO: Use a default controller and change paths with the Router.

	var ModelController = function ModelController() {};
	fire.controller(ModelController);

	ModelController.prototype.basePathComponents = ['api', 'v1'];

	// TODO: Check if we need to do something with before
	/*
	ModelController.prototype.before = function() {
		var self = this;
		return this.models.User.getOne({accessToken:this.session.at})
			.then(function(user) {
				self.user = user;
			});
	};
	*/

	ModelController.prototype['get' + name] = function() {
		return this.models[modelName].find(this.query);
	};

	ModelController.prototype['update' + modelName] = function($id) {
		return this.models[modelName].update({id: $id}, this.body);
	};

	ModelController.prototype['get' + modelName] = function($id) {
		return this.models[modelName].getOne({id: $id});
	};

	if(model.isAuthenticator()) {
		ModelController.prototype['create' + modelName] = function() {
			console.log('Create user');

			var self = this;

			return this.models[modelName].create(this.body)
				.then(function(instance) {
					self.session.at = instance.accessToken;
					return instance;
				});
		};
	}
	else {
		ModelController.prototype['create' + modelName] = function() {
			return this.models[modelName].create(this.body);
		};
	}

	/*
	ModelController.prototype.deleteModel = function(models, $id) {
		//
	};
	*/

	if(model.isAuthenticator()) {
		var AuthorizeController = function AuthorizeController() {};
		fire.controller(AuthorizeController);

		AuthorizeController.prototype.basePathComponents = ['api', 'v1'];

		AuthorizeController.prototype.postAuthorize = function() {
			var model = this.models[modelName];

			var map = {};
			map[model.options.authenticatingProperty.name] = this.body[model.options.authenticatingProperty.name];

			// TODO: Do not hard code this property like this.
			map.password = this.body.password;

			var self = this;
			return model.getOne(map)
				.then(function(instance) {
					self.session.at = instance.accessToken;
					return instance;
				})
				.fail(function(error) {
					console.log(error);
					throw error;
				});
		};
	}
};