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

	return this._validateChanges()
		.then(function() {
			if(this._map == null) {
				return this.callHooks(['beforeCreate', 'beforeSave']);
			}
			else {
				return this.callHooks('beforeSave');
			}
		}.bind(this))
		.then(function() {
			if(this._map == null) {
				return this._model.create(this._changes);
			}
			else {
				return this._model.updateOne(this._changes, {id: this._map['id']});
			}
		}.bind(this))
		.then(function(row) {
			var isNew = (this._map == null);

			this._changes 	= {};
			this._map 		= row;

			if(isNew) {
				return this.callHooks(['afterCreate', 'afterSave']);
			}
			else {
				return this.callHooks('afterSave');
			}
		}.bind(this))
		.then(function() {
			return this;
		}.bind(this))
		.fail(function(error) {
			console.log('error in save');
			console.log(error);
			console.log(error.stack);
		})
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
