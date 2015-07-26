var Generator = require('../generator');
var path = require('path');
var utils = require('./../../../helpers/utils');

function _getControllerResolves(controller) {
	function _transformConstructor(constructor) {
		function _returnParamName() {
			return function(paramName, index, array) {
				if(index == (array.length - 1)) {
					return paramName;
				}
				else {
					return '\'' + paramName + '\'';
				}
			};
		}

		var params = utils.getMethodArgumentNames(constructor);
		var constructorBody = utils.stripMethodFirstLine(constructor);
		params.push('function(' + params.join(', ') + ') ' + constructorBody);

		return params.map(_returnParamName()).join(', ');
	}

	var resolves = [];

	var resolveMap = controller.constructor.prototype.resolve ? controller.constructor.prototype.resolve() : null;

	if(resolveMap) {
		Object.keys(resolveMap).forEach(function(key) {
			var resolver = resolveMap[key];
			resolves.push({
				name: key,
				params: _transformConstructor(resolver)
			});
		});
	}

	return resolves;
}

/**
 * Generates all controller services and all local routes for the angular-route module.
 *
 * @return {Generator} A generator instance which holds the information to render this module.
 * @name Bridge~generateFireControllers
 * @memberof Bridge
 */
exports = module.exports = function() {
	var controllers = [];

	this.app.controllers.forEach(function(controller) {
		// path, templatePath, name
		controllers.push({
			paths: controller.paths,
			name: controller.constructor.name,
			templatePath: controller.templatePath,
			tests: controller.tests,
			resolves: _getControllerResolves(controller)
		});
	});

	return new Generator(path.join(__dirname, '..', this.app.settings('type'), 'templates', 'routes.js'), {controllers: controllers});
};
