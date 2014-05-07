'use strict';

exports = module.exports = QueryMiddleware;

var Q = require('q');
var url = require('url');

function QueryMiddleware() {
	
}

QueryMiddleware.prototype.parseConnection = function(connection, controller) {
	controller.param = function(name) {
		if(!controller.params) {
			var parsed = url.parse(connection.request.url, true);
			controller.params = parsed.query || {};
		}

		return controller.params[name];
	};
};
