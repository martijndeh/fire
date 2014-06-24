'use strict';

var path = require('path');
var config = require('./helpers/config');
var util = require('util');
var argv = require('minimist')(process.argv.slice(2));

function Firestarter() {
	this._app = null;
}
	
Firestarter.prototype.app = function(name, options) {
	if(!this._app) {
		config.basePath = path.resolve('./');

		// TODO: Implement workers again.

		this._app = new (require('./app'))(name, options);
	}
	
	return this._app;
};

Firestarter.prototype.model = function(modelConstructor) {
	util.inherits(modelConstructor, require('./modules/models/model'));

	var self = this;
	setImmediate(function() {
		if(self._app) {
			self._app.addModelConstructor(modelConstructor);
		}
	});
};

Firestarter.prototype.controller = function(controllerConstructor) {
	util.inherits(controllerConstructor, require('./modules/controllers/controller'));

	var self = this;
	setImmediate(function() {
		if(self._app) {
			self._app.addControllerConstructor(controllerConstructor);
		}
	});
};

exports = module.exports = new Firestarter();