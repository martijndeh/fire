'use strict';

exports = module.exports = Property;

var inflection = require('inflection');

function Property(name, types, model, models) {
	this.model 		= model;
	this.name		= name;
	this.columnName	= inflection.underscore(name);
	this.clauses	= [];
	this.models		= models;

	this.manyAssociation 	= null;
	this.oneAssociation		= null;
	this.referenceName 		= null;
	this.autoFetch 			= false;

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

Property.prototype.isAssociation = function() {
	if(this.manyAssociation) {
		return true;
	}

	if(this.oneAssociation) {
		return true;
	}

	return false;
}

Property.prototype.getReference = function() {
	return this.models.getModel(this.referenceName);
};

Property.prototype.columnNameIndicator = '_nof_';