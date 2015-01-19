'use strict';

exports = module.exports = Generate;

var path = require('path');
var inflection = require('inflection');
var utils = require('./../../helpers/utils');
var Models = require('./../models');

var Model = require('./../models/model');
var Migration = require('./migration');
var Migrations = require('./');

var Q = require('q');

var pg = require('pg');
pg.defaults.poolIdleTimeout = 500;

var mu = require('mu2');

var PropertyTypes = require('./../models/property-types');

var debug = require('debug')('fire:generate');

/**
 * This module, executed from the cli, is responsible for the creation of the migrations.
 *
 * @access private
 *
 * @param {String} startPath The root path of the app.
 * @constructor
 */
function Generate(app, startPath) {
	this.path = startPath;
	this.delegate = null;
	this.app = app;
}

/**
 * This method creates the migrations by loading all the migrations in a Models module, and loading all existing models in another Models module. Then migrations are created based on the differences of the two Models.
 *
 * Warning: this method swizzles (replaces) some methods on the Model's prototype and it currently does not sets them back.
 */
Generate.prototype.createMigrations = function(fromBuild) {
	if(!this.delegate) {
		throw new Error('No delegate set on Generate.');
	}

	if(!this.app) {
		throw new Error('No app set on Generate.');
	}

	if(!fromBuild) {
		console.log([
			'Warning: please update your Gruntfile.js.',
			'',
			'Node on Fire now includes a Build module which implements your `grunt build` and `grunt release` tasks. This is helpful because it makes it possible to improve these tasks without you having to manually update your Gruntfile.js.',
			'',
			'Update your Gruntfile to (something like) the following:',
			'',
			'var build = require(\'fire/lib/modules/build\');',
			'',
			'module.exports = function(grunt) {',
			'	var config = {',
			'		pkg: grunt.file.readJSON(\'package.json\')',
			'	};',
			'',
			'	config = build.extendConfig(config, grunt);',
			'',
			'	// Add your own Grunt tasks here.',
			'',
			'	grunt.initConfig(config);',
			'};',
			'',
			'Additionally please include the grunt-contrib-less, grunt-contrib-uglify and grunt-contrib-jade. To install them run the following command:',
			'',
			'\t$ npm install grunt-contrib-less grunt-contrib-uglify grunt-contrib-jade --save-dev',
			''
		].join('\n'));
	}

	// These are based on the actualy models
	var newModels = this.app.models;
	var oldModels = new Models(this.app);
	var migrations 	= new Migrations();

	function addPropertiesMigrationTask(model, properties) {
		var string = '\tthis.models.' + model.getName() + '.addProperties({\n';

		string += properties.map(function(property) {
			return '\t\t' + property.name + ': ' + propertyTypesToString(property);
		}).join(',\n') + '\n';

		string += '\t});\n';
		return string;
	}

	function changePropertiesMigrationTask(model, properties) {
		var string = '\tthis.models.' + model.getName() + '.changeProperties({\n';

		string += properties.map(function(property) {
			return '\t\t' + property.name + ': ' + propertyTypesToString(property);
		}).join(',\n') + '\n';

		string += '\t});\n';
		return string;
	}

	function removePropertiesMigrationTask(model, properties) {
		var string = '\tthis.models.' + model.getName() + '.removeProperties([';

		string += properties.map(function(property) {
			return '\'' + property.name + '\'';
		}).join(', ');

		string += ']);\n';
		return string;
	}

	function createModelMigrationTask(model) {
		debug('createModelMigrationTask');

		var string = '\tthis.models.createModel(\'' + model.getName() + '\', {\n';

		var propertiesMap = model.getAllProperties();

		var properties = Object.keys(propertiesMap).map(function(propertyName) {
			var property = propertiesMap[propertyName];

			return '\t\t' + propertyName + ': ' + propertyTypesToString(property);
		});

		string += properties.join(',\n') + '\n';
		string += '\t});\n';
		return string;
	}

	function destroyModelMigrationTask(model) {
		return '\tthis.models.destroyModel(\'' + model.getName() + '\');\n';
	}

	function propertyTypesToString(property) {
		return '[' + property.types.map(function(type) {
			while(typeof type == 'function') {
				type = type.call(property, property);
			}

			if(!type) {
				throw new Error('No type in propertyTypesToString.');
			}

			var propertyTypeString = 'this.' + type.name;

			if(type.params && type.params.length > 0 && type.params[0] != property) {
				propertyTypeString += '(' + type.params.map(function(value, index) {
					// TOOD: Check if `value` is a model thingy?
					// TODO: Check if `value` exists on model?
					// For now, let's check if this is: Reference, Many, HasOne, HasMany

					var name = value;

					if(value instanceof Model) {
						name = value.getName();
					}

					if(['HasOne', 'HasMany', 'BelongsTo'].indexOf(type.name) >= 0) {
						if(index === 0) {
							return 'this.models.' + name;
						}
						else {
							return '"' + name + '"';
						}
					}
					else {
						if(typeof name == 'string') {
							return '\'' + name.replace(/'/g, '\\\'') + '\'';
						}
						else {
							return name;
						}
					}
				}).join(', ') + ')';
			}

			return propertyTypeString;
		}).join(', ') + ']';
	}

	// Let's swizzle some methods
	Object.keys(PropertyTypes).forEach(function(propertyName) {
		Model.prototype[propertyName] = function() {
			var args = new Array(arguments.length);
			for(var i = 0; i < args.length; ++i) {
				args[i] = arguments[i];
			}

			// This is a dirty hack.
			if(propertyName == 'Authenticate') {
				var model = this.model;
				model.options.authenticatingProperty = this;
			}

			return {
				name: propertyName,
				params: args
			};
		};
	});

	Object.keys(PropertyTypes).forEach(function(propertyName) {
        // We check if it's set already, as e.g. migrations swizzle these methods
        Migration.prototype[propertyName] = function() {
			var args = new Array(arguments.length);
			for(var i = 0; i < args.length; ++i) {
				args[i] = arguments[i];
			}

			return {
				name: propertyName,
				params: args
			};
		};
    });

	var toVersion = 0;
	var self = this;
	var basePath = this.path;

	// Let's load all models
	return newModels.setup(basePath)
		.then(function() {
			self.app.modules.forEach(function(module_) {
				if(module_.migrate) {
					module_.migrate(newModels);
				}
			});
		})
		.then(function() {
			debug('Old models setup.');

			return oldModels.setup(null);
		})
		.then(function() {
			debug('Loading migrations to `oldModels` from `' + path.join(basePath, '_migrations') + '`.');

			// and load all migrations
			return migrations.loadMigrations(path.join(basePath, '_migrations'), oldModels);
		})
		.then(function() {
			debug('Reseting migration-models');

			// Now we copy all models and remove them from the models
			// We do a soft-migration to the last migration
			// Then compare all models created by the soft migration with the models we copied earlier
			// We create migrations based on the differences
			// Let's go!

			return migrations.resetAllModels();
		})
		.then(function() {
			debug('Soft migrating to ' + toVersion);

			if(migrations._.length > 0) {
				var lastMigration = migrations._[migrations._.length - 1];
				toVersion = lastMigration.version;
			}

			return migrations.softMigrate(toVersion);
		})
		.then(function() {
			debug('Creating migration tasks');

			var upMigrationTasks = [];
			var downMigrationTasks = [];

			var migrationNames = [];

			// Now check the copied models and figure out what to migrate
			newModels.forEach(function(newModel) {
				debug('Checking model `' + newModel.getName() + '`');

				var oldModel = oldModels.findModel(newModel.getName());

				if(!oldModel) {
					//create newModel, easy
					migrationNames.push('create', inflection.dasherize(newModel.getName()));

					upMigrationTasks.push(createModelMigrationTask(newModel));
					downMigrationTasks.push(destroyModelMigrationTask(newModel));
				}
				else {
					// Check all properties and see if something changed
					var removedProperties = [];
					var addedProperties = [];
					var changedProperties = [];
					var originalChangedProperties = [];

					var newPropertiesMap = newModel.getAllProperties();
					var oldPropertiesMap = oldModel.getAllProperties();

					var parsedPropertyNames = [];

					Object.keys(newPropertiesMap).forEach(function(propertyName) {
						var oldProperty = oldPropertiesMap[propertyName];
						var newProperty = newPropertiesMap[propertyName];

						if(!oldProperty) {
							addedProperties.push(newProperty);
						}
						else {
							var new_ = propertyTypesToString(newProperty);
							var old = propertyTypesToString(oldProperty);

							if(new_ != old) {
								changedProperties.push(newProperty);
								originalChangedProperties.push(oldProperty);
							}
						}

						parsedPropertyNames.push(propertyName);
					});

					Object.keys(oldPropertiesMap).forEach(function(propertyName) {
						if(parsedPropertyNames.indexOf(propertyName) == -1) {
							removedProperties.push(oldPropertiesMap[propertyName]);
						}
					});

					if(addedProperties.length > 0) {
						migrationNames.push('add', 'to', inflection.dasherize(newModel.getName()));

						upMigrationTasks.push(addPropertiesMigrationTask(newModel, addedProperties));
						downMigrationTasks.push(removePropertiesMigrationTask(newModel, addedProperties));
					}

					if(removedProperties.length > 0) {
						migrationNames.push('remove', 'from', inflection.dasherize(newModel.getName()));

						upMigrationTasks.push(removePropertiesMigrationTask(newModel, removedProperties));
						downMigrationTasks.push(addPropertiesMigrationTask(newModel, removedProperties));
					}

					if(changedProperties.length > 0) {
						migrationNames.push('edit', inflection.dasherize(newModel.getName()));

						upMigrationTasks.push(changePropertiesMigrationTask(newModel, changedProperties));
						downMigrationTasks.push(changePropertiesMigrationTask(newModel, originalChangedProperties));
					}
				}
			});

			if(upMigrationTasks.length > 0 && downMigrationTasks.length > 0) {
				var version = (parseInt(toVersion) + 1);
				var migrationFileName;
				if(version == 1) {
					migrationFileName = '001.js';
				}
				else {
					migrationFileName = utils.zeroPad(version, 100) + '.js';
				}

				// TODO: Check to see if directory exists.

				var stream = mu.compileAndRender(path.join(__dirname, 'templates', 'migration.js'), {
					migrationName: 'Migration',
					upTasks: function() {
						return upMigrationTasks.map(function(contents) {
							return {contents: contents};
						});
					},
					downTasks: function() {
						return downMigrationTasks.map(function(contents) {
							return {contents: contents};
						});
					}
				});

				var result = Q.when(true);

				if(self.delegate.addMigration) {
					result = Q.when(self.delegate.addMigration(migrationFileName, stream));
				}

				return result
					.then(function() {
						console.log('Created migration file at `' + migrationFileName + '`.');

						return true;
					});
			}
			else {
				console.log('Your local migrations are up-to-date.');
				return false;
			}
		})
		.catch(function(error) {
			console.log(error);
			console.log(error.stack);

			throw error;
		});
};
