'use strict';

var Table = require('./table');
var inflection = require('inflection');
var utils = require('./../../helpers/utils');
var Property = require('./property');
var Q = require('q');
var crypto = require('crypto');

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

var propertyTypes = {
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
	Boolean: function() {
		return Table.keywords.Boolean;
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

	ReadOnly: function(readOnly) {
		return function(property) {
			property.options.isVirtual = true;
			property.options.readOnly = readOnly;
		};
	},

	Id: function() {
		return Table.keywords.Id;
	},

	UUID: function() {
		return Table.keywords.UUID;
	},

	Default: function(defaultValue) {
		if(typeof defaultValue == 'function') {
			return function(property) {
				property.options.defaultValue = defaultValue;
			};
		}
		else {
			return {
				clause: Table.keywords.Default(defaultValue)
			};
		}
	},

	Hash: function(method) {
		return function(property) {
			property.options.hashMethod = method;
		};
	},

	AutoFetch: function() {
		return function(property) {
			property.options.autoFetch = true;
		};
	},

	Virtual: function(value) {
		return function(property) {
			property.options.isVirtual = value || true;
		};
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

	Select: function(method) {
		return function(property) {
			property.options.selectMethod = method;
			property.options.isVirtual = true;
		};
	},

	BelongsTo: function(modelNameOrModel, linkedPropertyName) {
		if(modelNameOrModel) {
			return function(property) {
				property.columnName 			= property.columnName + '_id';
				property.options.referenceName 	= toModelName(modelNameOrModel);
				property.options.belongsTo 		= true;

				if(linkedPropertyName) {
					property.options.linkedPropertyName = linkedPropertyName;
				}

				var associatedModel = property.getAssociatedModel();
				if(associatedModel) {
					// Now, find any associations which reference this model
					var associations = associatedModel.findAssociationsTo(property.model, linkedPropertyName);

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
						clause: Table.keywords.References(associatedModel.getTable().getName()),
						dataType: 'UUID'
					};
				}
				else {
					return {
						index: 999,
						clause: Table.keywords.References(inflection.tableize(property.options.referenceName)),
						dataType: 'UUID'
					};
				}
			};
		}

		return null;
	},

	Has: function(hasModel, hasMethod) {
		return function(property) {
			property.options.isVirtual = true;
			property.options.hasMethod = hasMethod;
			property.options.hasModel = hasModel;
		};
	},

	HasMany: function(modelNameOrModel, linkedPropertyName) {
		// `modelNameOrModel` may be falsy. Likely during a soft migration. Do not throw an error here.
		if(modelNameOrModel) {
			return function(property) {
				// Set reference to the current model
				property.options.referenceName 	= toModelName(modelNameOrModel);

				if(linkedPropertyName) {
					property.options.linkedPropertyName = linkedPropertyName;
				}

				// Now let's check if this is a many-to-many reference
				var associatedModel = property.getAssociatedModel();
				var associatedProperty = null;

				if(associatedModel) {
					// Now, find any associations which reference this model
					var associations = associatedModel.findAssociationsTo(property.model, linkedPropertyName);

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

							// We sort the names, to make sure we always generate the same table.
							var names = [inflection.pluralize(property.model.getName()), inflection.pluralize(associatedModel.getName())];
							names.sort();
							var name = names[0] + names[1];

							var properties = {};
							properties.id = [];
							properties[inflection.camelize(property.model.getName(), true)] = [property.model.BelongsTo(property.model)];
							properties[inflection.camelize(associatedModel.getName(), true)] = [associatedModel.BelongsTo(associatedModel)];

							var model = property.model.models.findModel(name);

							// findModel may return a string for the forward reference methods.
							if(!model || typeof model != 'object') {
								model = property.model.models.createModel(name, properties);
							}

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

	HasOne: function(modelNameOrModel, linkedPropertyName) {
		if(modelNameOrModel) {
			return function(property) {
				property.options.referenceName 	= toModelName(modelNameOrModel);
				property.options.hasOne 		= inflection.camelize(property.model.getName(), true);

				if(linkedPropertyName) {
					property.options.linkedPropertyName = linkedPropertyName;
				}

				var associatedModel = property.getAssociatedModel();
				if(associatedModel) {
					var associations = associatedModel.findAssociationsTo(property.model, linkedPropertyName);

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
	},

	Count: function(propertyName) {
		return function(property) {
			property.options.isVirtual = true;

			var targetProperty = property.model.getProperty(propertyName);
			if(!targetProperty) {
				throw new Error('Cannot find property with name `' + propertyName + '`.');
			}

			// The many-to-many relation likely does not exist yet.
			property.options.counting = propertyName;
		};
	},

	Authenticate: function() {
		return function(property) {
			var model = property.model;

			model.options.authenticatingProperty = property;
			property.options.authenticate = true;

			model.addProperty(new Property('password', [model.String, model.Required, model.Private, model.Hash(function(value) {
				var hash = crypto.createHash('sha512');
				hash.update(value);
				return hash.digest('hex');
			})], model), true);

			model.addProperty(new Property('accessToken', [model.String, model.Private, model.Default(function() {
				var defer = Q.defer();
				crypto.randomBytes(128, function(error, buffer) {
					if(error) {
						defer.reject(error);
					}
					else {
						defer.resolve(buffer.toString('hex'));
					}
				});
				return defer.promise;
			})], model), true);
		};
	},

	Private: function() {
		return function(property) {
			property.options.isPrivate = true;
		};
	},

	// An automatic property is automatically set to the current authenticator when it's created. See PropertyTypes#Authenticate on how to set the authenticator.
	Automatic: function() {
		return function(property) {
			var model = property.model;

			property.options.isAutomatic = true;

			// Currently multiple automatic property names per model isn't possible.
			if(model.options.automaticPropertyName && model.options.automaticPropertyName != property.name) {
				throw new Error('Adding an automatic property on `' + model.getName() + '` but an automatic property already exists. Currently only one automatic property is supported.');
			}

			model.options.automaticPropertyName = property.name;

			// We'll disable manual updates to this property as this is probably not the intention.
			// In case updating should happen, simply set this.Update(true) on the property type (after this.Automatic).
			property.options.canUpdate = false;
		};
	},

	Create: function(propertyKeyPathOrFunction) {
		return function(property) {
			property.options.isVirtual = true;
			property.model.setAccessControl('create', propertyKeyPathOrFunction);
		};
	},

	Read: function(propertyKeyPathOrFunction) {
		return function(property) {
			property.options.isVirtual = true;
			property.model.setAccessControl('read', propertyKeyPathOrFunction);
		};
	},

	Update: function(propertyKeyPathOrFunction) {
		return function(property) {
			// TODO: Do not hard code like this...
			if(property.name == 'accessControl') {
				property.options.isVirtual = true;
				property.model.setAccessControl('update', propertyKeyPathOrFunction);
			}
			else {
				property.options.canUpdate = propertyKeyPathOrFunction;
			}
		};
	},

	Delete: function(propertyKeyPathOrFunction) {
		return function(property) {
			property.options.isVirtual = true;
			property.model.setAccessControl('delete', propertyKeyPathOrFunction);
		};
	}
};

exports = module.exports = propertyTypes;
