'use strict';

function App(name) {
	this.name = name;
	this.controllersMap = {};
	this.dependencyMap = {};
}

App.prototype.run = function() {
	//
};

App.prototype.service = function(serviceName, parameters) {
	this.inject(serviceName, function(context) {

	});
};

App.prototype.inject = function(name, callback) {
	this.dependencyMap[name] = function(context) {
		return callback(context);
	};
};

App.prototype.execute = function(constructor, context, params) {
	var self = this;
	return constructor.apply(context, params.map(function(param) {
		if(self.dependencyMap[param]) {
			return self.dependencyMap[param](context);
		}
		else if(window[param]) {
			return window[param];
		}
		else {
			throw new Error('Unknown dependency `' + param + '`.');
		}
	}));
};

App.prototype.controller = function(controllerName, parameters) {
	var constructor = parameters[parameters.length - 1];
	parameters.splice(parameters.length - 1, 1) ;

	this.controllersMap[controllerName] = {
		params: parameters,
		constructor: constructor
	};
};

App.prototype.location = function(path) {
	window.history.pushState({}, '', path);

	this.loadController(href);
};

/* jshint undef: true, unused: true */
var fire = {
	appsMap: {},
	module: function(name, options) {
		if(!this.appsMap[name]) {
			this.appsMap[name] = new App(name, options);
		}

		return this.appsMap[name];
	}
};

// TODO: Add module names: {{moduleNames}}
var app = fire.module('{{name}}', []);

app.inject('self', function(controller) {
	return controller;
});

$(window).on('popstate', function() {
	app.loadController(window.location.pathname);
});

Ractive.events.submit = function(node, fire) {
	$(node).on('submit', function(event) {
		event.preventDefault();

		fire({
			node: node,
			original: event
		});
	});

	return {
		teardown: function() {
			$(node).off('submit');
		}
	};
};

Ractive.events.change = function(node, fire) {
	var eventName = 'change';

	if($(node).prop('tagName') == 'INPUT' || $(node).prop('tagName') == 'TEXTAREA') {
		eventName = 'keyup';
	}

	$(node).on(eventName, function(event) {
		fire({
			node: node,
			original: event
		});
	});

	return {
		teardown: function() {
			$(node).off(eventName);
		}
	};
};

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
