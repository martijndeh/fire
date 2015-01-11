'use strict';

//{{>fire.js}}
//{{>injector.js}}
//{{>controller.js}}

function __dasherize(str) {
	return str
		.trim()
		.replace(/([^A-Z-])([A-Z0-9])([^A-Z])/g, '$1-$2$3')
		.toLowerCase();
}

function __createDependencyMap(parameters) {
	var constructor = null;
	var params = null;

	if(typeof parameters == 'function') {
		constructor = parameters;
		params = [];
	}
	else {
		params = parameters;
		var constructor = params.pop();
	}

	return {
		params: params,
		constructor: constructor
	};
};

function App(name) {
	this.name = name;
	this.routes = [];
	this.servicesMap = {};
	this.currentController = null;

	this.injector = new Injector();

	var self = this;
	this.injector.register('app', function() {
		return self;
	});
}

App.prototype.run = function(name, parameters) {
	var map = __createDependencyMap(parameters);

	this.injector.execute({}, map.constructor, map.params, {});
};

App.prototype.tag = function(tagName, parameters) {
	var tagMap = __createDependencyMap(parameters);
	var tag = {};
	this.injector.execute(tag, tagMap.constructor, tagMap.params, {});

	if(typeof tag.name == 'undefined') {
		tag.name = __dasherize(tagName);
	}

	if(tag.templateUrl) {
		//{{=<% %>=}}
		tag.template = '{{#ready}}{{>templatePartial}}{{/}}';
		//<%={{ }}=%>

		var callback = tag.onconstruct;

		tag.onconstruct = function() {
			var self = this;
			Q.when($.get(this.templateUrl))
				.then(function(partial) {
					self.partials.templatePartial = partial;
					self.set('ready', true);

					if(callback) {
						return callback();
					}
				});
		}
	}

	Ractive.components[tag.name] = Ractive.extend(tag);
};

App.prototype.event = function(eventName, parameters) {
	var self = this;
	Ractive.events[__dasherize(eventName)] = function(node, fire) {
		var eventMap = __createDependencyMap(parameters);

		var event = this;
		self.injector.execute(event, eventMap.constructor, eventMap.params, {node: node, fire: fire, self: event});
		return event;
	};
};

App.prototype.decorator = function(decoratorName, parameters) {
	var self = this;
	Ractive.decorators[__dasherize(decoratorName)] = function() {
		var params = Array.prototype.splice.call(arguments, 1);
		var node = arguments[0];

		var decoratorMap = __createDependencyMap(parameters);
		var decorator = {};
		self.injector.execute(decorator, decoratorMap.constructor, decoratorMap.params, {node: node, params: params});

		return decorator;
	};
};

App.prototype.service = function(serviceName, parameters) {
	var self = this;
	this.injector.register(serviceName, function() {
		if(typeof self.servicesMap[serviceName] != 'undefined') {
			return self.servicesMap[serviceName];
		}
		else {
			var serviceMap = __createDependencyMap(parameters);

			var service = {};
			self.injector.execute(service, serviceMap.constructor, serviceMap.params, {});

			self.servicesMap[serviceName] = service;
			return service;
		}
	});
};

App.prototype.controller = function(controllerPath, controllerName, parameters) {
	var self = this;
	var createController = function(routeParams) {
		var controllerMap = __createDependencyMap(parameters);
		return self.loadController(controllerName, controllerMap, routeParams);
	};
	createController.path = controllerPath;
	createController.pathRegex = new RegExp('^' + (controllerPath.replace(/:([^/]+)/g, '([^/]+)')) + '$', 'i');

	this.routes.push(createController);
};

App.prototype.location = function(location, state, title, dontPush) {
	var path = null;
	var queryParams = state || {};
	var search = null;

	if(typeof location == 'object') {
		path = location.pathname;

		if(location.search.length > 1) {
			search = location.search.substring(1);
		}
	}
	else {
		var index = location.indexOf('?');
		if(index !== -1) {
			path = location.substring(0, index);
			search = location.substring(index + 1);
		}
		else {
			path = location;
		}
	}

	if(search) {
		var queryParams = {};
		search.split('&').map(function(field) {
			var result = field.split('=');

			queryParams[result[0]] = result.length > 1 ? result[1] : '';
		});
	}

	if(!dontPush) {
		window.history.pushState(state || {}, title || null, path);
	}

	// This should return a promise whether loading failed or not. If it fails we pop the state again.
	var currentRoute = null;
	for(var i = 0, il = this.routes.length; i < il; i++) {
		var route = this.routes[i];

		if(route.pathRegex.test(path)) {
			currentRoute = route;
			break;
		}
	}

	if(currentRoute) {
		var paramNames = [];
		var regex = new RegExp('^' + currentRoute.path.replace(/:([^/]+)/g, function(full, param) {
			paramNames.push(param);
			return '([^/]+)';
		}) + '$', 'i');

		var result = regex.exec(path);
		var routeParams = queryParams || {};
		for(var i = 1, il = result.length; i < il; i++) {
			routeParams[paramNames[i - 1]] = result[i];
		}

		return currentRoute(routeParams);
	}
	else {
		// TODO: What do we do with a 404? Find a 404 controller?
		console.log('Unknown route.');
	}
};

App.prototype.loadController = function(controllerName, controllerMap, routeParams) {
	console.log('App#loadController ' + controllerName);

	var controller = new Controller(app, controllerName, controllerMap, routeParams);
	var self = this;

	// TODO: What if we're loading multiple controllers?

	return controller.build()
		.then(function() {
			if(self._currentController) {
				self._currentController.destroy();
			}

			self._currentController = controller;
		});
};

//{{>ractive-events.js}}

var app = fire.module('{{name}}', []);

$(window).on('popstate', function(event) {
	console.log('window#popstate');
	console.log(window.location);

	return app.location(window.location, {}, null, true);
});

$(function() {
	$(document).on('click', 'a, area', function(event) {
		var href = $(this).attr('href');
		event.preventDefault();

		app.location(href);
	});
});

{{#methods}}
app.{{type}}({{{contents}}});
{{/methods}}
