'use strict';

exports = module.exports = Property;

var inflection = require('inflection');

function Property(name, types, models) {
	this.name		= name;
	this.columnName	= inflection.underscore(name);
	this.clauses	= [];
	this.models		= models;

	this.referenceName = null;
	this.autoFetch = false;

	var self = this;
	types.forEach(function(type) {
		var clause = null;
		if(typeof type == 'function') {
			// We prefer a function argument over calling `this.`
			clause = type.call(self, self);
		}
		else {
			clause = type;
		}

		if(clause && clause.length > 0) {
			self.clauses.push(clause);
		}
	});
}

Property.prototype.getReference = function() {
	var model = this.models[this.referenceName];

	if(!model) {
		throw new Error('Could not find model `' + this.referenceName + '` in property `' + this.name + '`.');
	}

	return model;
};

Property.prototype.columnNameIndicator = '_nof_';