'use strict';

exports = module.exports = ModuleProperties;

var inflection = require('inflection');

/**
 * The ModuleProperties module sets all modules as properties to an object. This module will be replaced once dependency injection is broadly available. See {@link ModuleProperties#set}.
 *
 * @constructor
 */
function ModuleProperties(app) {
	this.app = app;
}

ModuleProperties.prototype.stages = ['build', 'release', 'run'];

/**
 * Sets all of the app's modules as properties to object. For example, this creates `object.models` referencing the Models module, `object.HTTPServer` to the HTTPServer module and many more.
 *
 * @param  {Object} object The object on which the properties are added.
 */
ModuleProperties.prototype.set = function(object) {
	this.app.modules.forEach(function(module_) {
		if(module_.enableModuleProperty) {
			// TODO: Property name transformation is not DRY. It's also in the App.
			var propertyName = inflection.camelize(module_.constructor.name, (module_.constructor.name.length <= 1 || module_.constructor.name.substring(1, 2).toLowerCase() == module_.constructor.name.substring(1, 2)));

			if(!object[propertyName]) {
				Object.defineProperty(object, propertyName, {
					value: module_,
					configurable: true
				});
			}
		}
	});
};
