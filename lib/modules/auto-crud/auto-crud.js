'use strict';

exports = module.exports = AutoCrud;

var fire = require('./../../firestarter');
var inflection = require('inflection');

function AutoCrud(app) {
	this.app = app;
}

AutoCrud.prototype.setup = function() {
	var self = this;
	this.app.models.forEach(function(model, modelName) {
		self._createRoute(modelName, model);
	});
};

AutoCrud.prototype._createRoute = function(modelName, model) {
	var name = inflection.pluralize(modelName).toLowerCase();

	// So we'll create a controller for this model on the fly.

	var ModelController = function ModelController() {
		
	};
	fire.controller(ModelController);

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

	ModelController.prototype.getBasePath = function(fullPath) {
		return [];
	};

	ModelController.prototype.getPath = function(method, methodName, paths) {
		var string = '^/api/v1/';

		string += '(' + name + ')';

		// The following method name require an additional parameter.
		if(methodName == 'updateModel' || methodName == 'getModel') {
			string += '/([^/]+)';
		}

		string += '(?:/)?$';

		return new RegExp(string, 'i');
	};

	ModelController.prototype.getModels = function(models) {
		return this.models[modelName].find(this.query);
	};

	ModelController.prototype.updateModel = function(models, $id) {
		return this.models[modelName].update({id: $id}, this.body);
	};

	ModelController.prototype.getModel = function(models, $id) {
		return this.models[modelName].getOne({id: $id});
	};

	if(model.isAuthenticator()) {
		ModelController.prototype.createModel = function(models) {
			var self = this;

			return this.models[modelName].create(this.body)
				.then(function(instance) {
					self.session.at = instance.accessToken;
					return instance;
				});
		};
	}
	else {
		ModelController.prototype.createModel = function(models) {
			return this.models[modelName].create(this.body);
		};
	}

	/*
	ModelController.prototype.deleteModel = function(models, $id) {
		//
	};
	*/

	this.app.controllers.loadClass(ModelController);

	if(model.isAuthenticator()) {
		var AuthorizeController = function AuthorizeController() {

		};
		fire.controller(AuthorizeController);

		AuthorizeController.prototype.getBasePath = function(fullPath) {
			return ['api', 'v1'];
		};

		AuthorizeController.prototype.postAuthorize = function(authorize) {
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

		this.app.controllers.loadClass(AuthorizeController);
	}
};