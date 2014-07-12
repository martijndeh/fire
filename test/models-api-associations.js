/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');

describe('models api associations', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Parent() {
				this.name = [this.String];
				this.childs = [this.HasMany(this.models.Child)];
				this.privates = [this.HasMany(this.models.Private), this.Private];
				this.accessControl = [this.Create(function() { return true; }), this.Read(function() { return true; }), this.Update(function() { return true; }), this.Delete(function() { return true; })];
			}
			app.model(Parent);

			function Child() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
				this.accessControl = [this.Create(function() { return true; }), this.Read(function() { return true; }), this.Update(function() { return true; }), this.Delete(function() { return true; })];
			}
			app.model(Child);

			function Private() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
			}
			app.model(Private);
		};

		helper.createModels = function(app) {
			var result = Q.when(true);

			for(var i = 0, il = 4; i < il; i++) {
				result = result.then(function() {
					return app.models.Parent.create({name: 'Test'})
						.then(function(parent) {
							return Q.all([
								app.models.Child.create({name: 'Test', parent: parent}),
								app.models.Child.create({name: 'Test', parent: parent}),
								app.models.Child.create({name: 'Test', parent: parent})
							]);
						});
				});
			}

			return result;
		};
	});

	it('can find many', function(done) {
		request(helper.app.express)
			.get('/api/parents/1/childs')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 3);
				done(error);
			});
	});

	it('cannot find private many', function(done) {
		request(helper.app.express)
			.get('/api/parents/1/privates')
			.send()
			.expect(404, function(error, response) {
				console.log(response.body);
				done(error);
			});
	});
});
