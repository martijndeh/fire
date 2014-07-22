/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');
var uuid = require('node-uuid');

describe('models api associations', function() {
	var parentID = uuid.v4();
	var child1ID = null;
	var child2ID = null;
	var child3ID = null;

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
			return app.models.Parent.create({id: parentID, name: 'Test'})
				.then(function(parent) {
					if(!parentID) {
						parentID = parent.id;
					}

					return Q.all([
						app.models.Child.create({name: 'Test', parent: parent}),
						app.models.Child.create({name: 'Test', parent: parent}),
						app.models.Child.create({name: 'Test', parent: parent})
					]);
				})
				.spread(function(child1, child2, child3) {
					child1ID = child1.id;
				});
		};
	});

	it('can find many', function(done) {
		request(helper.app.express)
			.get('/api/parents/' + parentID + '/childs')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 3);
				done(error);
			});
	});

	it('cannot find private many', function(done) {
		request(helper.app.express)
			.get('/api/parents/' + parentID + '/privates')
			.send()
			.expect(404, function(error, response) {
				done(error);
			});
	});

	it('can update one', function(done) {
		request(helper.app.express)
			.put('/api/parents/' + parentID + '/childs/' + child1ID)
			.send({
				name: 'Updated Name'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.id, child1ID);
				assert.equal(response.body.name, 'Updated Name');
				done(error);
			});
	})
});
