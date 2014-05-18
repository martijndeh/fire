'use strict';

var Table = require('./table');
var inflection = require('inflection');
var utils = require('./utils');
var Property = require('./property');

function toModelName(modelNameOrModel) {
	var modelName = '';
	if(typeof modelNameOrModel == 'string') {
		modelName = modelNameOrModel;
	}
	else {
		modelName = modelNameOrModel.getName();
	}
	return modelName;
}

exports = module.exports = {
	Many: function() {
		throw new Error('Many is deprecated. Please use HasMany-BelongsTo combination for many-to-one associations and HasMany-HasMany combination for many-to-many associations.');
	},
	Reference: function() {
		throw new Error('Reference is deprecated.');
	},
	One: function() {
		throw new Error('One is deprecated.');
	},

	Text: function() {
		return Table.keywords.Text;
	},
	String: function() {
		return Table.keywords.Text;
	},
	Number: function() {
		return Table.keywords.Integer;
	},
	Integer: function() {
		return Table.keywords.Integer;
	},
	Date: function() {
		return Table.keywords.Date;
	},
	DateTime: function DateTime() {
		return Table.keywords.Timestamp;
	},
	Timestamp: function() {
		return Table.keywords.Timestamp;
	},
	Time: function() {
		return Table.keywords.Time;
	},
	Interval: function() {
		return Table.keywords.Interval;
	},
	Unsigned: function() {
		return {
			clause: Table.keywords.Unsigned
		};
	},
	Serial: function() {
		return Table.keywords.Serial;
	},
	PrimaryKey: function() {
		return {
			clause: Table.keywords.PrimaryKey
		};
	},
	Unique: function() {
		return {
			clause: Table.keywords.Unique
		};
	},
	Required: function() {
		return function(property) {
			property.options.required = true;

			// TODO: We should overhaul this system: we shouldn't be adding clauses, they should be configured per property
			// This allows us to easily set different properties on relating properties
			// TODO: Set required on any relationships
			
			return {
				clause: Table.keywords.NotNull
			};
		};
	},

	Id: function() {
		return Table.keywords.Id;
	},

	Default: function(defaultValue) {
		return {
			clause: Table.keywords.Default(defaultValue)
		};
	},

	AutoFetch: function() {
		return function(property) {
			property.options.autoFetch = true;
		};
	},

	Virtual: function() {
		return function(property) {
			property.options.isVirtual = true;
		}
	},

	Transform: function(method) {
		return function(property) {
			property.options.transformMethod = method;
			property.options.transformKeyNames = utils.getMethodArgumentNames(method);

			var model = property.model;
			for(var i = 0, il = property.options.transformKeyNames.length; i < il; i++) {
				var key = property.options.transformKeyNames[i];

				model.addProperty(new Property(key, [model.Virtual]));
			}
		};
	},

	BelongsTo: function(modelNameOrModel) {
		if(modelNameOrModel) {
			return function(property) {
				property.columnName 			= property.columnName + '_id';
				property.options.referenceName 	= toModelName(modelNameOrModel);
				property.options.belongsTo 		= true;

				var associatedModel = property.getAssociatedModel();
				if(associatedModel) {
					// Now, find any associations which reference this model
					var associations = associatedModel.findAssociationsTo(property.model);

					if(associations.length > 1) {
						throw new Error('Multiple associations to `' + property.model.getName() + '` exists on `' + associatedModel.getName() + '`.');
					}
					else if(associations.length == 1) {
						var associatedProperty = associations[0];

						property.options.belongsTo = associatedProperty.name;

						if(associatedProperty.options.hasMany) {
							associatedProperty.options.hasMany = property.name;
						}
						else {
							// TODO: Set hasOne?
						}

						associatedProperty.options.relationshipVia = property;
						property.options.relationshipVia = associatedProperty;
					}
				}

				if(associatedModel) {
					return {
						index: 999,
						clause: Table.keywords.References(associatedModel.getTable().getName())
					};
				}
				else {
					return {
						index: 999,
						clause: Table.keywords.References(inflection.tableize(property.options.referenceName))
					};
				}
			};
		}

		return null;
	},

	HasMany: function(modelNameOrModel) {
		// `modelNameOrModel` may be falsy. Likely during a soft migration. Do not throw an error here.
		if(modelNameOrModel) {
			return function(property) {
				// Set reference to the current model
				property.options.referenceName 	= toModelName(modelNameOrModel);

				// Now let's check if this is a many-to-many reference
				var associatedModel = property.getAssociatedModel();
				var associatedProperty = null;

				if(associatedModel) {
					// Now, find any associations which reference this model
					var associations = associatedModel.findAssociationsTo(property.model);

					if(associations.length > 1) {
						throw new Error('Multiple associations to `' + property.model.getName() + '` exists on `' + associatedModel.getName() + '`.');
					}
					else if(associations.length == 1) {
						associatedProperty = associations[0];

						// TODO: should we set name, or something else?
						property.options.hasMany = associatedProperty.name;
					}
					else {
						// Could not find an association
						// ... this could be part of a one-to-many association
						// so let's just set:
						property.options.hasMany = inflection.camelize(property.model.getName(), true);
					}

					if(associatedProperty) {
						if(associatedProperty.options.hasMany) {
							// Now we link many-to-many associatedModel and property.model
							var name = inflection.pluralize(property.model.getName()) + inflection.pluralize(associatedModel.getName());

							var properties = {};
							properties.id = [];
							properties[inflection.camelize(property.model.getName(), true)] = [property.model.BelongsTo(property.model)];
							properties[inflection.camelize(associatedModel.getName(), true)] = [associatedModel.BelongsTo(associatedModel)];

							var model = property.model.models.createModel(name, properties);

							// .. and let's also set the options.hasMany thingy correctly on both properties
							associatedProperty.options.hasMany = property.name;

							// Through is the model which connects the two relationships
							associatedProperty.options.through = model;
							property.options.through = model;
						}
						else if(associatedProperty.options.belongsTo) {
							associatedProperty.options.belongsTo = property.name;

							// TODO: Set the columnName?
						}
						else {
							// ... any other cases we need to cover?
						}

						// RelationshipVia is the property of the other model
						associatedProperty.options.relationshipVia 	= property;
						property.options.relationshipVia 			= associatedProperty;
					}
				}
				else {
					// Couldn't find the associated model yet, so we can't know the right property
					property.options.hasMany = true;
				}
			};
		}

		return null;
	},

	HasOne: function(modelNameOrModel) {
		if(modelNameOrModel) {
			return function(property) {
				property.options.referenceName 	= toModelName(modelNameOrModel);
				property.options.hasOne 		= inflection.camelize(property.model.getName(), true);

				var associatedModel = property.getAssociatedModel();
				if(associatedModel) {
					var associations = associatedModel.findAssociationsTo(property.model);

					if(associations.length > 1) {
						throw new Error('Multiple associations to `' + property.model.getName() + '` exists on `' + associatedModel.getName() + '`.');
					}
					else if(associations.length == 1) {
						var associatedProperty = associations[0];

						// If this is a hasMany, let's set the correct name
						if(associatedProperty.options.hasMany) {
							associatedProperty.options.hasMany = property.name;
						}
						else if(associatedProperty.options.belongsTo) {
							associatedProperty.options.belongsTo = property.name;
							associatedProperty.columnName = property.name + '_id';
						}
						else {
							// TODO: Anything we want to do here?
						}

						associatedProperty.options.relationshipVia = property;
						property.options.relationshipVia = associatedProperty;
					}
				}
			};
		}

		return null;
	}
};