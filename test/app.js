var fire = require('..');

describe('app', function() {
	it('should start & stop', function(done) {
		var app = fire();
		return app.run()
			.then(function() {
				app.server.close();

				return done();
			});
	})
})
