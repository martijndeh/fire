var Generator = require('../generator');
var debug = require('debug')('fire:bridge');
var inflection = require('inflection');
var utils = require('../../../helpers/utils');
var path = require('path');

/**
 * Generates a client-side library to manage your models with a 1-to-1 API as the models api on the server-context.
 *
 * For more information on the API itself, see the Models module.
 *
 * @name Bridge~generateModels
 * @return {Generator} A generator instance which holds the information to render this module.
 */
exports = module.exports = function() {
	var models = [];

	this.app.models.forEach(function(model) {
		var modelName = model.getName();

		var properties = [];

		var allProperties = model.getAllProperties();
		var propertyNames = Object.keys(allProperties);

		var methodMaps = [];

		debug('Generate model `' + modelName + '`.');
		debug(propertyNames);

		debug('Authenticator: ' + model.isAuthenticator());

		propertyNames.forEach(function(propertyName) {
			var property = allProperties[propertyName];

			if(!property.options.isPrivate) {
				if(property.isAssociation()) {
					if(property.isManyToMany()) {
						methodMaps.push({
							isXToMany: true,

							pluralMethodName: utils.ucfirst(inflection.pluralize(propertyName)),
							singularMethodName: utils.ucfirst(inflection.singularize(propertyName)),

							resource: inflection.transform(propertyName, ['tableize', 'dasherize']).toLowerCase(),

							propertyName: propertyName,
							modelName: property.options.relationshipVia.model.getName()
						});
					}
					else if(property.options.hasMany) {
						if(!property.options.relationshipVia) {
							throw new Error('Found has many relationship but could not find link. Did you call HasMany-BelongsTo on the correct models?');
						}

						methodMaps.push({
							isXToMany: true,

							pluralMethodName: utils.ucfirst(inflection.pluralize(propertyName)),
							singularMethodName: utils.ucfirst(inflection.singularize(propertyName)),

							resource: inflection.transform(propertyName, ['tableize', 'dasherize']).toLowerCase(),

							propertyName: propertyName,
							modelName: property.options.relationshipVia.model.getName()
						});
					}
					else if(property.options.hasOne || property.options.belongsTo) {
						if(property.options.relationshipVia) {
							methodMaps.push({
								isOneToOne: true,

								methodName: utils.ucfirst(inflection.capitalize(propertyName)),

								resource: inflection.transform(propertyName, ['underscore', 'dasherize']).toLowerCase(),

								propertyName: propertyName,
								modelName: property.options.relationshipVia.model.getName()
							});
						}
						else {
							// Some one-to-many or one-to-one associations do not have the relationshipVia set e.g. on many-to-many, the couple model.
						}
					}
				}
				else if(property.options.hasMethod) {
					methodMaps.push({
						isHasMethod: true,
						getMethodName: 'get' + inflection.capitalize(propertyName),
						resource: inflection.transform(propertyName, ['underscore', 'dasherize']).toLowerCase(),
						modelName: property.options.hasModel.getName()
					});
				}

				properties.push(property);
			}
		});

		models.push({
			name: modelName,
			properties: properties,
			resource: inflection.transform(modelName, ['tableize', 'dasherize']).toLowerCase(),
			isAuthenticator: model.isAuthenticator(),
			authenticatingPropertyName: model.options.authenticatingProperty ? model.options.authenticatingProperty.name : null,
			methods: methodMaps
		});
	});

	return new Generator(path.join(__dirname, '..', this.app.settings('type'), 'templates', 'models.js'), {models: models});
};
