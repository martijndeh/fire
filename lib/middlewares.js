exports = module.exports = Middlewares;

var Q = require('q');

function Middlewares() {
	//please make sure, if middlewares assign anything 
	this._ = [
		new (require('./middlewares/json'))(),
		new (require('./middlewares/cookies'))(),
		new (require('./middlewares/session'))(),
		new (require('./middlewares/query'))()
	];
}

Middlewares.prototype.callAll = function(methodName, connection, controller) {
	return this._.reduce(function(soFar, middleware) {
		return soFar.then(function() {
			return middleware[methodName] && middleware[methodName](connection, controller);
		})
	}, Q(true));

	/*
	var defer = Q.defer();

	//todo: change this to something nicer...
	function forEachMiddleware(array, i) {
		if(i < array.length) {
			var middleware = array[i];

			//todo: the neatest thing would be to not pass the controller to the middlewares but assign the return value of middlewares to a controller's property instead
			//that way, all connect (express) based middlewares should work with node on fire
			if(middleware[methodName]) {
				middleware[methodName](connection, controller)
					.then(function() {
						forEachMiddleware(array, ++i);
					})
					.fail(function(error) {
						defer.reject(error);
					})
					.done();
			}
			else {
				forEachMiddleware(array, ++i);
			}
		}
		else {
			defer.resolve();
		}
	}

	forEachMiddleware(this._, 0);
	return defer.promise;
	*/
}

Middlewares.prototype.parseConnection = function(connection, controller) {
	return this.callAll('parseConnection', connection, controller);
}

Middlewares.prototype.sendConnection = function(connection, controller) {
	return this.callAll('sendConnection', connection, controller);
}