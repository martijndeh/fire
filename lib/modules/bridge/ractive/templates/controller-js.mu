/* global Q, $, Ractive */

function Controller(app, name, templateUrl) {
	this.app = app;
	this.name = name;
	this.templateUrl = templateUrl;
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

	$.get(this.templateUrl, function(templateHtml) {
		var controllerMap = self.app.controllersMap[self.name];
		var data = {};
		var ractive = new Ractive({
			el: 'view',
			template: templateHtml,
			data: data
		});

		self.context = {
			ractive: ractive,

			// TODO: Add any other methods on the controller?

			location: function(path) {
				return self.app.location(path);
			},
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

		self.app.injector.execute(self.context, controllerMap.constructor, controllerMap.params, {});

		Object.keys(self.context).forEach(function(key) {
			if(ignoreKeys.indexOf(key) === -1) {
				var promise = self.context[key];

				Object.defineProperty(self.context, key, {
					set: function(value) {
						data[key] = value;
						ractive.set(key, value);

						if(typeof value == 'function') {
							ractive[key] = value;
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
	})
	.fail(function(error) {
		defer.reject(error);
	});

	return defer.promise;
};
