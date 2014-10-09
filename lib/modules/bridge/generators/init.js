var Generator = require('../generator');
var util = require('util');
var utils = require('./../../../helpers/utils');
var path = require('path');

function _transformArray(array) {
	return array.map(function(argument) {
		if(typeof argument == 'string') {
			return '\'' + argument + '\'';
		}
		else if(util.isArray(argument)) {
			return '[' + _transformArray(argument) + ']';
		}
		else {
			return argument;
		}
	});
}

function _transformConstructor(constructor, methodType) {
	function _returnParamName(constructorName) {
		return function(paramName, index, array) {
			if(index == (array.length - 1)) {
				return paramName;
			}
			else {
				if(paramName == 'fire') {
					// If it's the fire module in a controller, we transform it to Fire{{controllerName}}.
					if(methodType == 'controller') {
						return '\'Fire' + constructorName + '\'';
					}
					else {
						return '\'fire\'';
					}
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
 * Generates the initial angular.Module and all the methods like angular.directive(...).
 *
 * @return {Generator} A generator instance which holds the information to render this module.
 * @name Bridge~generateFireInit
 * @memberof Bridge
 */
exports = module.exports = function() {
	var methods = [];

	for(var i = 0, il = this._.length; i < il; i++) {
		var method = this._[i];

		// If the first and only argument is a constructor (a function with a name)
		// we transform it to two arguments: 1. the name, 2. an array with the argument names and the function itself.
		if(method.arguments.length == 1 && typeof method.arguments[0] == 'function' && method.arguments[0].name) {
			var transformedConstructor = _transformConstructor(method.arguments[0], method.type);
			methods.push({
				type: method.type,
				contents: '\'' + transformedConstructor.name + '\', [' + transformedConstructor.params + ']'
			});
		}
		else {
			methods.push({
				type: method.type,
				contents: _transformArray(method.arguments)
			});
		}
	}

	var moduleNames = (this.app.options.modules || []).map(function(moduleName) {
		return '\'' + moduleName + '\'';
	});

	return new Generator(path.join(__dirname, 'templates/init-js.mu'), {
		name: this.app.name,
		methods: methods,
		moduleNames: moduleNames
	});
};
