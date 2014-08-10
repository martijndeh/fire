var Generator = require('../generator');
var utils = require('./../../../helpers/utils');

function _transformConstructor(constructor) {
	function _returnParamName(constructorName) {
		return function(paramName, index, array) {
			if(index == (array.length - 1)) {
				return paramName;
			}
			else {
				if(paramName == 'fire') {
					return '\'Fire' + constructorName + '\'';
				}
				else {
					return '\'' + paramName + '\'';
				}
			}
		};
	}

	var params = utils.getMethodArgumentNames(constructor);
	var constructorBody = utils.stripMethodFirstLine(constructor);
	params.push('function(' + params.join(', ') + ') ' + constructorBody);

	return {
		name: constructor.name,
		params: params.map(_returnParamName(constructor.name)).join(', ')
	};
}

/**
 * Generates the controllers.
 *
 * ```js
 * function TestController($scope) {
 * 	$scope.test = function() {
 * 		console.log('test');
 * 	};
 * }
 * app.controller(TestController);
 * ```
 *
 * Roughly generates:
 *
 * ```js
 * app.controller('TestController', ['$scope', function($scope) {
 * 	$scope.test = function() {
 * 		console.log('test');
 * 	};
 * }]);
 * ```
 *
 * @return {Generator} A generator instance which holds the information to render this module.
 * @name Bridge~generateLocalControllers
 */
exports = module.exports = function() {
	var controllers = [];

	this.app.controllers.forEach(function(controller) {
		controllers.push(_transformConstructor(controller));
	});

	return new Generator('controllers.js', {
		controllers: controllers
	});
};
