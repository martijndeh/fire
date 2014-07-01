/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var request = require('supertest');

describe('controller session', function() {
	var app = null;

	beforeEach(function(done) {
		app = fire.app('accessControlTest', {});

		function SessionController() {}
		app.controller(SessionController);

		SessionController.prototype.doTest = function() {
			var count = this.session.count || 0;
			this.session.count = ++count;

			return {
				count: count
			};
		};

		app.run()
			.then(function() {
				done();
			})
			.done();
	});

	afterEach(function(done) {
		app.stop()
			.then(function() {
				done();
			})
			.done();
	});

	it('keeps track of count', function(done) {
		var agent = request.agent(app.express);

		agent
			.post('/test')
			.expect(200, function(error, response) {
				assert.equal(error, null);
				assert.notEqual(response.header['set-cookie'], null);
				assert.equal(response.body.count, 1);

				agent
					.post('/test')
					.expect(200, function(error2, response2) {
						assert.equal(error2, null);
						assert.equal(response2.body.count, 2);

						done();
					});
			});
	});
});