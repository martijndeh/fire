exports = module.exports = Responders;

var LessResponder = require('./responders/less');
var StaticResponder = require('./responders/static');

var Q = require('q');

function Responders() {
	//todo: autoload all responders and order based on it's set priority
	this._ = [
		new LessResponder(),
		new StaticResponder()
	];
}

Responders.prototype.parseConnection = function(connection) {
	var defer = Q.defer();

	function forEachResponder(array, i) {
		if(i < array.length) {
			var responder = array[i];

			responder.parseConnection(connection)
				.then(function(contents) {
					defer.resolve(contents);
				})
				.fail(function() {
					forEachResponder(array, ++i);
				})
				.done();
		}
		else {
			defer.reject();
		}
	}

	forEachResponder(this._, 0);
	return defer.promise;
}