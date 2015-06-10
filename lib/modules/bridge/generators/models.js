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
		var modelConstructorDependencies = utils.getMethodArgumentNames(model.constructor);

		var modelDependencies = [];
		var modelDependencyNames = [];
		var modelInstanceDependencies = [];
		var modelInstanceDependencyNames = [];

		['$http', '$q', 'FireModel', '$injector', '$route', '$routeParams', '$location'].forEach(function(dependency) {
			if(modelDependencies.indexOf(dependency) == -1) {
				modelDependencies.push(dependency);
				modelDependencyNames.push('\'' + dependency + '\'');
			}
		});

		[modelName + 'Model', '$q', '$http', '$injector'].forEach(function(dependency) {
			if(modelInstanceDependencies.indexOf(dependency) == -1) {
				modelInstanceDependencies.push(dependency);
				modelInstanceDependencyNames.push('\'' + dependency + '\'');
			}
		});

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

				properties.push(property);
			}
		});

		// TODO: merge methods and otherMethods.

		var otherMethodMaps = [];
		var methods = model.getMethods();

		var injectorsBody = '';
		modelConstructorDependencies.forEach(function(dependencyName) {
			injectorsBody += 'var ' + dependencyName + ' = $injector.get(\'' + dependencyName + '\');\n';
		});

		Object.keys(methods).forEach(function(methodName) {
			var method = methods[methodName];
			var parameters = utils.getMethodArgumentNames(method).join(', ');

			otherMethodMaps.push({
				methodName: methodName,
				injectorsBody: injectorsBody,
				parameters: parameters,
				methodBody: utils.stripMethodFirstLine(method)
			});
		});

		models.push({
			name: modelName,
			modelDependencies: modelDependencies.join(', '),
			modelDependencyNames: modelDependencyNames.join(', '),
			modelInstanceDependencies: modelInstanceDependencies.join(', '),
			modelInstanceDependencyNames: modelInstanceDependencyNames.join(', '),
			properties: properties,
			resource: inflection.transform(modelName, ['tableize', 'dasherize']).toLowerCase(),
			isAuthenticator: model.isAuthenticator(),
			authenticatingPropertyName: model.options.authenticatingProperty ? model.options.authenticatingProperty.name : null,
			methods: methodMaps,
			otherMethods: otherMethodMaps
		});
	});

	return new Generator(path.join(__dirname, '..', this.app.settings('type'), 'templates', 'models.js'), {models: models});
};
