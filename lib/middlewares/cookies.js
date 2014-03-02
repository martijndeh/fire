exports = module.exports = CookiesMiddleware;

var Q = require('q');
var Cookies = require('cookies');
var config = require('./../config');

function CookiesMiddleware() {
	
}

CookiesMiddleware.prototype.parseConnection = function(connection, controller) {
	controller.cookies = new Cookies(connection.request, connection.response, config.cookieSecrets);
	return Q(controller.cookies);
}

