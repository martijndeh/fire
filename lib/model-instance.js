exports = module.exports = ModelInstance;

var inflection = require('inflection');
var Q = require('q');
var util = require('util');
var Model = require('./model')

function ModelInstance(model, row, changes) {
	this._model = model;
	this._map = row || null;
	this._changes = changes || {};

	//todo: replace with actual inheritance
	for(var methodName in this._model) {
		if(!Model.prototype[methodName] && typeof this._model[methodName] == 'function') {
			this[methodName] = this._model[methodName];
		}
	}

	this.models = this._model.models;
	this.workers = this._model.workers;

	this.callHooks('beforeLoad');

	var properties = model.getAllProperties();

	Object.keys(properties).forEach(function(propertyName) {
		var columnName = inflection.underscore(propertyName);
		Object.defineProperty(this, propertyName, {
			get: function() {
				return this._changes[columnName] || this._map[columnName];
			},

			set: function(value) {
				// TODO: check if it's the same value

				this._changes[columnName] = value;
			}
		})
	}.bind(this));

	this.callHooks('afterLoad');
}

ModelInstance.prototype._validateChanges = function() {
	/*
	var result = Q(true);

	Object.keys(this._changes).forEach(function(propertyName) {
		result = result.then(function() {

		})
	})

	return result;
	*/

	//var validators = [];
	for(var propertyName in this._changes) {
		var propertyValue = this._changes[propertyName];

		var validateMethodName = 'validate' + inflection.camelize(propertyName);

		if(this._model[validateMethodName]) {
			var result = this._model[validateMethodName].call(this, propertyValue);

			if(!result) {
				var error = new Error('Cannot validate ' + propertyName + '.');
				error.status = 400;
				throw error;
			}
			else if(result instanceof Error) {
				throw result;
			}
		}
	}

	return Q(true);
}

ModelInstance.prototype.save = function() {
	//todo: check if we changed something
	//todo: check if id exists

	var self = this;
	return this._validateChanges()
		.then(function() {
			if(self._map == null) {
				return self.callHooks(['beforeCreate', 'beforeSave']);
			}
			else {
				return self.callHooks('beforeSave');
			}
		})
		.then(function() {
			if(self._map == null) {
				return self._model.create(self._changes);
			}
			else {
				return self._model.updateOne(self._changes, {id: self._map['id']});
			}
		})
		.then(function(row) {
			var isNew = (self._map == null);

			self._changes 	= {};
			self._map 		= row;

			if(isNew) {
				return self.callHooks(['afterCreate', 'afterSave']);
			}
			else {
				return self.callHooks('afterSave');
			}
		})
		.then(function() {
			return self;
		})
		.fail(function(error) {
			throw error;
		});
}

ModelInstance.prototype.callHooks = function(hookNames) {
	if(!util.isArray(hookNames)) {
		hookNames = [hookNames];
	}

	return hookNames.reduce(function(soFar, hookName) {
		return soFar.then(function() {
			if(this._model[hookName]) {
				return Q(this._model[hookName].call(this));
			}
			else {
				return Q();
			}
		}.bind(this))
	}.bind(this), Q(true))
}
