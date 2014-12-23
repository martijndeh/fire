/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');
var uuid = require('node-uuid');
var helper = require('./support/helper');

describe('models api delete', function() {
	var parentID = uuid.v4();

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Parent() {
				this.name = [this.String];
				this.childs = [this.HasMany(this.models.Child)];
				this.accessControl = [this.CanDelete(function() { return true; })];
			}
			app.model(Parent);

			function Child() {
				this.name = [this.String];
				this.status = [this.String, this.Required];
				this.parent = [this.BelongsTo(this.models.Parent)];
				this.accessControl = [this.CanDelete(function() { return true; })];
			}
			app.model(Child);
		};

		helper.createModels = function(app) {
			return app.models.Parent.create({id: parentID, name: 'Test'})
				.then(function(parent) {
					return app.models.Child.create([{
						name: 'Test 1',
						status: 'open',
						parent: parent
					}, {
						name: 'Test 2',
						status: 'open',
						parent: parent
					}, {
						name: 'Test 3',
						status: 'closed',
						parent: parent
					}, {
						name: 'Test 4',
						status: 'open',
						parent: null
					}]);
				});
		};
	});

	it('can delete all associations', function(done) {
		request(helper.app.HTTPServer.express)
			.delete('/api/parents/' + parentID + '/childs')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 3);

				helper.app.models.Child.find()
					.then(function(childs) {
						assert.equal(childs.length, 1);
						done(error);
					});
			});
	});

	it('can delete multiple associations', function(done) {
		request(helper.app.HTTPServer.express)
			.delete('/api/parents/' + parentID + '/childs?status=open')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 2);

				helper.app.models.Child.find({})
					.then(function(childs) {
						assert.equal(childs.length, 2);
						done(error);
					});
			});
	});

	it('can delete all', function(done) {
		request(helper.app.HTTPServer.express)
			.delete('/api/children?parent=' + parentID)
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 3);

				helper.app.models.Child.find({})
					.then(function(childs) {
						assert.equal(childs.length, 1);
						done(error);
					});
			});
	});
});
