'use strict';

var path = require('path');
var config = require('./helpers/config');
var util = require('util');
var argv = require('minimist')(process.argv.slice(2));

var Model = require('./modules/models/model');
var Controller = require('./modules/controllers/controller');

function Firestarter() {
	this._app = null;
	this.disabled = false;
}
	
Firestarter.prototype.app = function(name, opts) {
	if(!this._app) {
		config.basePath = path.resolve('./');

		// TODO: Implement workers again.
		var options = opts || {};
		if(this.disabled) {
			options.disabled = true;
		}

		this._app = new (require('./app'))(name, options);
	}
	
	// Please note: when calling fire.app(...) for a second time, it simply returns the cached app (if it's not been removed)
	// regardless of the name. It will also _not_ set any of the options.

	return this._app;
};

Firestarter.prototype.model = function(modelConstructor) {
	util.inherits(modelConstructor, Model);

	var self = this;
	setImmediate(function() {
		if(self._app) {
			self._app.addModelConstructor(modelConstructor);
		}
		else {
			throw new Error('WARNING: No `app` is defined.');
		}
	});
};

Firestarter.prototype.controller = function(controllerConstructor) {
	util.inherits(controllerConstructor, Controller);

	var self = this;
	setImmediate(function() {
		if(self._app) {
			self._app.addControllerConstructor(controllerConstructor);
		}
	});
};

exports = module.exports = new Firestarter();