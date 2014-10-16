/* global describe, beforeEach, afterEach, it */
'use strict';

var Q = require('q');
var streams = require('memory-streams');
var assert = require('assert');
var fire = require('./..');
var path = require('path');
var fs = require('fs');

//fs.writeFileSync(path.join(__dirname, 'fixtures', 'api', 'tester.js'), writeStream.toString());

describe('api generate model controllers', function() {
	var app = null;
	var setup = null;

	beforeEach(function(done) {
		setup = function() {
			function Tester() {
				this.name = [this.String];
				this.property1 = [this.Integer];
				this.property2 = [this.Integer];
				this.property3 = [this.Integer];
				this.property4 = [this.Integer];
			}
			app.model(Tester);

			function User() {
				this.email = [this.String, this.Authenticate];
				this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
				this.container = [this.BelongsTo(this.models.Container)];
			}
			app.model(User);

			function Collection() {
				this.apps = [this.Has(this.models.Tester, function() {
					return [];
				})];
			}
			app.model(Collection);

			function Container() {
				this.name = [this.String];
				this.users = [this.HasMany(this.models.User)];
			}
			app.model(Container);
		};

		app = fire.app('test', {disabled: true});

		return Q.when(setup(app))
			.then(function() {
				return app.models.setup();
			})
			.then(function() {
				return app.start();
			})
			.then(function() {
				done();
			})
			.done();
	});

	afterEach(function(done) {
		return app.stop()
			.then(function() {
				done();
			})
			.done();
	});

	it('write basic model controller', function(done) {
		var writeStream = new streams.WritableStream();

		return app.API.generateModelController(app.models.Tester, writeStream)
			.then(function() {
				//fs.writeFileSync(path.join(__dirname, 'fixtures', 'api', 'tester.js'), writeStream.toString());
				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures', 'api', 'tester.js')));

				done();
			})
			.catch(function(error) {
				done(error);
			});
	});

	it('write authenticator model controller', function(done) {
		var writeStream = new streams.WritableStream();

		return app.API.generateModelController(app.models.User, writeStream)
			.then(function() {
				//fs.writeFileSync(path.join(__dirname, 'fixtures', 'api', 'user.js'), writeStream.toString());

				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures', 'api', 'user.js')));

				done();
			})
			.catch(function(error) {
				done(error);
			});
	});

	it('write has method in model controller', function(done) {
		var writeStream = new streams.WritableStream();

		return app.API.generateModelController(app.models.Collection, writeStream)
			.then(function() {
				//fs.writeFileSync(path.join(__dirname, 'fixtures', 'api', 'collection.js'), writeStream.toString());

				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures', 'api', 'collection.js')));

				done();
			})
			.catch(function(error) {
				done(error);
			});
	});

	it('write associations in model controller', function(done) {
		var writeStream = new streams.WritableStream();

		return app.API.generateModelController(app.models.Container, writeStream)
			.then(function() {
				//fs.writeFileSync(path.join(__dirname, 'fixtures', 'api', 'container.js'), writeStream.toString());

				assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures', 'api', 'container.js')));

				done();
			})
			.catch(function(error) {
				done(error);
			});
	});
});
