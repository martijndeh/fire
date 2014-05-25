var fire = require('..');

describe('app', function() {
	it('should start & stop', function(done) {
		var app = fire.app();
		return app.run()
			.then(function(server) {
				server.close();

				return done();
			});
	})
})
