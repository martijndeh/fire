'use strict';

exports = module.exports = Property;

var inflection = require('inflection');

function Property(name, types, model, models) {
	this.model 		= model;
	this.name		= name;
	this.columnName	= inflection.underscore(name);
	this.clauses	= [];
	this.models		= models;

	this.options = {};
	
	this.manyAssociation 	= null;
	this.oneAssociation		= null;
	this.referenceName 		= null;
	this.autoFetch 			= false;
	this.required 			= false;

	this.types = types || [];

	var self = this;
	this.types.forEach(function(type) {
		while(typeof type == 'function') {
			// We prefer a function argument over calling `this.`
			type = type.call(self, self);
		}

		if(type && type.length > 0) {
			self.clauses.push(type);
		}
	});
}

Property.prototype.isAllowed = function() {
	return (!this.manyAssociation);
};

Property.prototype.isAssociation = function() {
	return (this.manyAssociation) || (this.oneAssociation);
};

Property.prototype.getReference = function() {
	var model = this.models.getModel(this.referenceName);

	model.getAllProperties();

	return model;
};

Property.prototype.columnNameIndicator = '_nof_';
