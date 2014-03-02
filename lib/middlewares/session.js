exports = module.exports = SessionMiddleware;

var Q = require('q');

function SessionMiddleware() {
	
}

SessionMiddleware.prototype.parseConnection = function(connection, controller) {
	var session = controller.cookies.get('SID');

	if(session) {
		controller.session = JSON.parse(session);
	}
	else {
		controller.session = {};
	}
	
	return Q(controller.session);
}

SessionMiddleware.prototype.sendConnection = function(connection, controller) {
	//todo: find a neater way to see if we changed a session...
	var session = JSON.stringify(controller.session);
	if(controller.cookies.get('SID') != session) {
		controller.cookies.set('SID', session, {
			httpOnly: true,
			maxage: 1000 * 60 * 60 * 24 * 7 * 4,
			path: '/',
			secure: false,
			httpOnly: true,
			signed: true,
			overwrite: true
		});
	}
	return Q(true);
}