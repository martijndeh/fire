var fire = require('..');

describe('first test', function() {
	it('should be supported', function(done) {
		var app = fire();
		app.run();
		
		done();
	})
})