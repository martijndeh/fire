'use strict';

exports = module.exports = ModuleProperties;

var inflection = require('inflection');

function ModuleProperties(app) {
	this.app = app;
}

ModuleProperties.prototype.ignoreDisabled = true;

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
