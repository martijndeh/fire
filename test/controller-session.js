/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var request = require('supertest');

describe('controller session', function() {
	var app = null;

	beforeEach(function(done) {
		process.env.SESSION_MAX_AGE_MS = 2000;

		app = fire.app('accessControlTest', {});

		function SessionController() {}
		app.controller(SessionController);

		SessionController.prototype.doTest = function() {
			if(this.session.count) {
				this.session.count = this.session.count + 1;
			}
			else {
				this.session.count = 1;
			}

			return {
				count: this.session.count
			};
		};

		SessionController.prototype.getTest = function() {
			this.session.save();

			return {
				count: this.session.count || 0
			};
		};

		fire.start()
			.then(function() {
				done();
			})
			.done();
	});

	afterEach(function() {
		return fire.stop();
	});

	it('keeps track of count', function(done) {
		var agent = request.agent(app.HTTPServer.express);

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

	it('can re-save session cookie', function(done) {
		this.timeout(3000);

		var agent = request.agent(app.HTTPServer.express);

		agent
			.post('/test')
			.expect(200, function(error, response) {
				assert.equal(error, null);
				assert.equal(response.body.count, 1);

				setTimeout(function() {
					agent
						.get('/tests')
						.expect(200, function(error, response2) {
							assert.notEqual(response2.header['set-cookie'], null);

							setTimeout(function() {
								agent
									.get('/tests')
									.expect(200, function(error2, response3) {
										assert.notEqual(response3.header['set-cookie'], null);
										assert.equal(response3.body.count, 1);

										done(error2);
									});
							}, 1000);
						});
				}, 1000);

			});
	});
});
