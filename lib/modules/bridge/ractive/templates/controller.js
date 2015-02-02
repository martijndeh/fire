/* global Q, $, Ractive */

function Controller(app, name, map, routeParams) {
	this.app = app;
	this.name = name;
	this.map = map;
	this.routeParams = routeParams;
	this.context = null;
}

Controller.prototype.wrapCallback = function(callback) {
	var self = this;
	return function() {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}

		var result = callback.apply(this, args);

		if(Q.isPromise(result)) {
			result.catch(function(error) {
				if(self.context.error) {
					self.context.error(error);
				}
			});
		}
		else {
			//
		}
	};
};

Controller.prototype.destroy = function() {
	// TODO: Remove anything?
};

Controller.prototype.build = function() {
	var defer = Q.defer();
	var self = this;

	if(!document.getElementById('view')) {
		throw new Error('In Controller#build no #view exists in the DOM.');
	}

	var controllerMap = self.map;
	var data = {};
	var ractive = new Ractive({
		el: 'view',
		//{{=<% %>=}}
		template: '{{#__ready}}{{>templatePartial}}{{/__ready}}',
		//<%={{ }}=%>
		data: data
	});

	self.context = {
		ractive: ractive,
		on: function(event, callback) {
			return ractive.on(event, self.wrapCallback(callback));
		},
		observe: function(keypath, callback) {
			return ractive.observe(keypath, self.wrapCallback(callback), {
				init: false
			});
		}
	};

	var ignoreKeys = Object.keys(self.context);

	self.app.injector.execute(self.context, controllerMap.constructor, controllerMap.params, this.routeParams);

	Object.keys(self.context).forEach(function(key) {
		if(ignoreKeys.indexOf(key) === -1) {
			var promise = self.context[key];

			Object.defineProperty(self.context, key, {
				set: function(value) {
					if(Q.isPromise(value)) {
						value
							.then(function(v) {
								self.context[key] = v;
							})
							.catch(function(error) {
								self.context[key] = null;

								if(self.context.error) {
									self.context.error(error);
								}
							});
					}
					else {
						data[key] = value;
						ractive.set(key, value);

						if(typeof value == 'function') {
							ractive[key] = value;
						}
					}
				},

				get: function() {
					return data[key];
				}
			});

			if(Q.isPromise(promise)) {
				promise
					.then(function(value) {
						// TODO: What should we set here?

						self.context[key] = value;
						//ractive.data[key] = value;
						//ractive[key] = value;
						//ractive.set(key, value);
					})
					.catch(function(error) {
						self.context[key] = null;

						if(self.context.error) {
							self.context.error(error);
						}
					});
			}
			else {
				if(typeof promise == 'function') {
					self.context[key] = self.wrapCallback(promise);
				}
				else {
					self.context[key] = promise;
				}
			}
		}
		else {
			//
		}
	});
	
	if(self.context.template) {
		ractive.partials.templatePartial = self.context.template;
		ractive.set('__ready', true);

		if(typeof self.context.ready == 'function') {
			self.context.ready();
		}

		defer.resolve(self);
	}
	else if(self.context.templateUrl) {
		$.get(self.context.templateUrl, function(templateHtml) {
			ractive.partials.templatePartial = templateHtml;
			ractive.set('__ready', true);

			if(typeof self.context.ready == 'function') {
				self.context.ready();
			}

			defer.resolve(self);
		})
		.fail(function(error) {
			defer.reject(error);
		});
	}

	return defer.promise;
};
