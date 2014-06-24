var fire = require('..');

describe('app', function() {
	it('should run & stop', function(done) {
		var app = fire.app();
		return app.run()
			.then(function() {
				return app.stop();
			})
			.then(function() {
				return done();
			});
	})
})
