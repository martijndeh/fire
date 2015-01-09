'use strict';

{{>fire.mu}}
{{>injector.mu}}
{{>controller-js.mu}}

function dasherize(str) {
	return str
		.trim()
		.replace(/([^A-Z-])([A-Z0-9])([^A-Z])/g, '$1-$2$3')
		.toLowerCase();
}

function App(name) {
	this.name = name;
	this.controllersMap = {};
	this.servicesMap = {};
	this.currentController = null;

	this.injector = new Injector();

	var self = this;
	this.injector.register('app', function() {
		return self;
	});
}

App.prototype.run = function(name, parameters) {
	var map = self._createDependencyMap(serviceName, parameters);

	this.injector.execute({}, map.constructor, map.params, {});
};

App.prototype._createDependencyMap = function(name, parameters) {
	var constructor = parameters[parameters.length - 1];
	parameters.splice(parameters.length - 1, 1);

	return {
		params: parameters,
		constructor: constructor
	};
};

App.prototype.tag = function(tagName, parameters) {
	var tagMap = this._createDependencyMap(tagName, parameters);
	var tag = this.injector.execute({}, tagMap.constructor, tagMap.params, {});

	if(typeof tag.name == 'undefined') {
		tag.name = dasherize(tagName);
	}

	if(tag.templateUrl) {
		{{=<% %>=}}
		tag.template = '{{#ready}}{{>templatePartial}}{{/}}';
		<%={{ }}=%>

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
	Ractive.events[dasherize(eventName)] = function(node, fire) {
		var eventMap = self._createDependencyMap(eventName, parameters);
		var event = self.injector.execute(this, eventMap.constructor, eventMap.params, {node: node, fire: fire, self: this});
		return event;
	};
};

App.prototype.decorator = function(decoratorName, parameters) {
	Ractive.decorators[dasherize(decoratorName)] = function() {
		console.log('Decorator arguments:');
		console.log(arguments);

		// TODO: Pass node and params

		return {
			teardown: function() {

			}
		};
	};
};

App.prototype.service = function(serviceName, parameters) {
	var self = this;
	this.injector.register(serviceName, function() {
		if(typeof self.servicesMap[serviceName] != 'undefined') {
			return self.servicesMap[serviceName];
		}
		else {
			var serviceMap = self._createDependencyMap(serviceName, parameters);

			var service = self.injector.execute({}, serviceMap.constructor, serviceMap.params, {});

			self.servicesMap[serviceName] = service;
			return service;
		}
	});
};

App.prototype.controller = function(controllerName, parameters) {
	this.controllersMap[controllerName] = this._createDependencyMap(controllerName, parameters);
};

App.prototype.location = function(path, state, title) {
	window.history.pushState(state || {}, title || '', path);

	this.loadController(href);
};

App.prototype.loadController = function(controllerName, templateUrl) {
	var controller = new Controller(app, controllerName, templateUrl);
	var self = this;

	// TODO: What if we're loading multiple controllers?

	return controller.build()
		.then(function() {
			if(self._currentController) {
				self._currentController.destroy();
			}

			self._currentController = controller;
		})
		.catch(function(error) {
			console.log(error);
		});
};

{{>ractive-events.mu}}

var app = fire.module('{{name}}', []);

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
