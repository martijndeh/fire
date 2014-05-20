exports = module.exports = Controller;

function __defineGetter(controller, name, value) {
	Object.defineProperty(controller, name, {
		value: value,
		writable: false,
		enumarable: false,
		configurable: false
	});
};

function Controller(models, request, response) {
	__defineGetter(this, 'session', request.session);
	__defineGetter(this, 'models', models);
	__defineGetter(this, 'param', function(name) {
		return request.param(name);
	});
	__defineGetter(this, 'body', request.body);
}

// This should be excluded from auto-route generations.
Controller.prototype.before = null;