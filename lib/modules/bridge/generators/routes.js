var Router = require('./../../controllers/router');
var Generator = require('../generator');
var path = require('path');
var utils = require('./../../../helpers/utils');

function _getControllerRoutes(controller, app) {
	var routes = [];

	var router = new Router(controller);
	router.delegate = {
		addRoute: function(route) {
			route.transformedPath = route.path.replace(/(:([^/]+))/g, '\' + $$$2 + \'');
			route.transformedParams = '{' + route.argumentNames.map(function(argumentName) {
				return argumentName + ': ' + argumentName;
			}).join(', ') +'}';
			routes.push(route);
		}
	};
	router.createRoutes();

	return routes;
}

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
 * Generates all controller services and all local routes for the ng-route module.
 *
 * For every controller, an angular service is generated named Fire + controller name. The service exposes the models service, a unwrap method and all controller operations.
 *
 * ```js
 * function TestController(fire, $scope) {
 * 	//
 * }
 * app.controller(TestController);
 *
 * TestController.prototype.doAction = function() {
 * 	return {value: 123};
 * };
 * ```
 *
 * roughly generates
 *
 * ```js
 * app.service('FireTestController', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
 * 	this.models = FireModels;
 * 	this.doAction = function() {
 * 		var defer = $q.defer();
 *
 * 		$http['post']('/action', {})
 * 			.success(function(result) {
 * 		 		defer.resolve(result);
 *      	})
 * 		    .error(function(error) {
 * 		    	defer.reject(error);
 * 		    });
 *
 * 		return defer.promise;
 * 	};
 * }]);
 * ```
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
