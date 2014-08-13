var Router = require('./../../controllers/router');
var Generator = require('../generator');

function _getControllerRoutes(controller) {
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
		controllers.push({
			name: controller.name,
			routes: _getControllerRoutes(controller)
		});
	});

	return new Generator('fire-js.mu', {controllers: controllers});
};
