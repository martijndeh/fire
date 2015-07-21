'use strict';

exports = module.exports = Property;

var inflection = require('inflection');
var Table = require('./table');

/**
 * @constructor
 * @access private
 */
function Property(name, types, model, models) {
	this.model 		= model;
	this.name		= name;
	this.columnName	= name[0] == '_' ? name : inflection.underscore(name);
	this.models		= models;

	this.options = {};

	// We store the original types as it used in the migrations ... right?
	this.types = types || [];

	if(!this.types.length) {
		throw new Error('Invalid property `' + name + '` with 0 property types. This should be ignored, but a property is already created.');
	}

	// Let's resolve all types and stored it in the results list
	var results = [];
	var dataType = null;

	var self = this;
	types.forEach(function(type) {
		// Resolve the types
		while(typeof type == 'function') {
			// We prefer a function argument over calling `this`.
			type = type.call(self, self);
		}

		if(type) {
			// If type is a string only, it's a data type
			// Else, it's an object and may contain a dataType property
			if(typeof type == 'string' || type.dataType) {
				if(dataType) {
					throw new Error('Duplicate data type: `' + dataType + '` already set but `' + type + '` is also being set. Please only specify one of them.');
				}

				dataType = type.dataType || type;
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

	if(this.options.isRequired) {
		results.push({
			clause: Table.keywords.NotNull,
			index: 1
		});
	}

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

Property.prototype.isManyToMany = function() {
	// So let's check if this is a many-to-many association
	if(this.options.referenceName && this.options.hasMany) {
		var associatedModel = this.getAssociatedModel();

		if(associatedModel) {
			var associatedProperty = associatedModel.getProperty(this.options.hasMany);
			return (!!associatedProperty && !!associatedProperty.options.hasMany);
		}
	}

	return false;
};

Property.prototype.resourceName = function() {
	return inflection.transform(this.name, ['tableize', 'dasherize']).toLowerCase();
};

Property.prototype.isSelectable = function() {
	return (!!this.options.selectMethod);
};

Property.prototype.isTransformable = function() {
	return (!!this.options.transformMethod);
};

Property.prototype.isAllowed = function() {
	return (!this.options.hasMany) && (!this.options.hasOne) && !this.options.isVirtual;
};

Property.prototype.isAssociation = function() {
	return (!!this.options.hasMany || !!this.options.hasOne || !!this.options.belongsTo);
};

Property.prototype.getAssociatedModelName = function() {
	return this.options.referenceName;
};

Property.prototype.getAssociatedModel = function() {
	// TODO: Change referenceName to e.g. associatedModelName ?!
	var model = this.models.getModel(this.options.referenceName);

	if(typeof model == 'string') {
		return null;
	}
	else {
		model.getAllProperties();
		return model;
	}
};

Property.prototype.getReference = function() {
	// TODO: Start deprecated this method (getReference)
	return this.getAssociatedModel();
};

Property.prototype.columnNameIndicator = '$';
