'use strict';

exports = module.exports = Property;

var inflection = require('inflection');
var Model = require('./model');

function Property(name, types, model, models) {
	this.model 		= model;
	this.name		= name;
	this.columnName	= inflection.underscore(name);
	this.models		= models;

	this.options = {};
	
	this.manyAssociation 	= null;
	this.oneAssociation		= null;
	this.referenceName 		= null;
	this.autoFetch 			= false;
	this.required 			= false;	

	// We store the original types as it used in the migrations ... right?
	this.types = types || [];

	if(this.types.length == 0) {
		throw new Error('Invalid property `' + name + '` with 0 property types. This isn\'t currently allowed.');
	}

	// Let's resolve all types and stored it in the results list
	var results = [];
	var dataType = null;

	var self = this;
	types.forEach(function(type) {
		// Resolve the types
		while(typeof type == 'function') {
			// We prefer a function argument over calling `this.`
			type = type.call(self, self);
		}

		if(type) {
			// If type is a string only, it's a data type
			// Else, it's an object and may contain a dataType property
			if(typeof type == 'string' || type.dataType) {
				if(dataType) {
					throw new Error('Duplicate data type: `' + dataType + '` already set but `' + type + '` is also being set.');
				}

				dataType = type;
			}

			if(type.clause) {
				// Store the type in the results
				// We default the index (which is later used for sorting) to 1
				results.push({
					clause: type.clause,
					index: type.index || 1
				});
			}
		}
	});

	// We default to dataType INTEGER
	// This is especially useful in associations
	if(!dataType) {
		dataType = 'INTEGER';
	}

	// Now we create the clauses by sorting types
	var clauses = results
		.sort(function(a, b) {
			return (a.index - b.index);
		})
		.map(function(type) {
			return type.clause;
		});
	clauses.unshift(dataType);

	this.clauses = clauses;
}

Property.prototype.isAllowed = function() {
	return (!this.manyAssociation);
};

Property.prototype.isAssociation = function() {
	return (this.manyAssociation) || (this.oneAssociation);
};

Property.prototype.getReference = function() {
	var model = this.models.getModel(this.referenceName);

	if(typeof model == 'string') {
		return null;
	}
	else {
		model.getAllProperties();
		return model;
	}
};

Property.prototype.columnNameIndicator = '_nof_';
