/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');
var uuid = require('node-uuid');
var helper = require('./support/helper');

describe('models api associations', function() {
	var parentID = uuid.v4();
	var child1ID = null;

	var article1ID = uuid.v4();
	var article2ID = uuid.v4();
	var user1ID = uuid.v4();
	var user2ID = uuid.v4();
	var user3ID = uuid.v4();

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Parent() {
				this.name = [this.String];
				this.childs = [this.HasMany(this.models.Child)];
				this.privates = [this.HasMany(this.models.Private), this.Private];
				this.list = [this.Has(this.models.Child, function(parent) {
					return this.models.Child.find({parent: parent});
				})];
				this.accessControl = [this.CanCreate(function() { return true; }), this.CanRead(function() { return true; }), this.CanUpdate(function() { return true; }), this.CanDelete(function() { return true; })];
			}
			app.model(Parent);

			function Child() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
				this.accessControl = [this.CanCreate(function() { return true; }), this.CanRead(function() { return true; }), this.CanUpdate(function() { return true; }), this.CanDelete(function() { return true; })];
			}
			app.model(Child);

			function Private() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
			}
			app.model(Private);

			function User() {
				this.name 			= [this.String, this.Unique];
				this.votes 			= [this.HasMany(this.models.Article, 'voters')];
				this.accessControl 	= [this.CanRead(function() { return false; }), this.CanUpdate(function() { return false; })];
			}
			app.model(User);

			function Article() {
				this.title 			= [this.String, this.Required];
				this.voters 		= [this.HasMany(this.models.User, 'votes'), this.AutoFetch, this.CanCreate(function(articleID) {
					return this.models.ArticlesUsers.findOne({user: this.body.user, article: articleID})
						.then(function(articleUser) {
							return (!articleUser);
						});
				})];
				this.accessControl 	= [this.CanRead(function() { return true; }), this.CanUpdate(function() { return true; }), this.CanDelete(function() { return false; })];
			}
			app.model(Article);
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
				.spread(function(child1) {
					child1ID = child1.id;
				})
				.then(function() {
					return app.models.Article.create([{
						id: article1ID,
						title: 'Test Article 1'
					}, {
						id: article2ID,
						title: 'Test Article 2'
					}]);
				})
				.then(function() {
					return app.models.User.create([{
						id: user1ID,
						name: 'User 1'
					}, {
						id: user2ID,
						name: 'User 2',

					}, {
						id: user3ID,
						name: 'User 3'
					}]);
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

	it('can create many-to-many', function(done) {
		request(helper.app.express)
			.post('/api/articles/' + article1ID + '/voters')
			.send(helper.jsonify({
				user: user1ID
			}))
			.expect(200, function(error, response) {
				console.log(response.body);

				assert.equal(response.body.voters.length, 1);

				done(error);
			});
	});

	it('cannot create multiple many-to-many', function(done) {
		request(helper.app.express)
			.post('/api/articles/' + article1ID + '/voters')
			.send(helper.jsonify({
				user: user1ID
			}))
			.expect(200, function(error, response) {
				assert.equal(response.body.voters.length, 1);

				request(helper.app.express)
					.post('/api/articles/' + article1ID + '/voters')
					.send(helper.jsonify({
						user: user1ID
					}))
					.expect(401, function(error) {
						done(error);
					});
			});
	});

	it('cannot find private many', function(done) {
		request(helper.app.express)
			.get('/api/parents/' + parentID + '/privates')
			.send()
			.expect(404, function(error) {
				done(error);
			});
	});

	it('can update one', function(done) {
		request(helper.app.express)
			.put('/api/parents/' + parentID + '/childs/' + child1ID)
			.send(helper.jsonify({
				name: 'Updated Name'
			}))
			.expect(200, function(error, response) {
				console.log(error);

				assert.equal(response.body.id, child1ID);
				assert.equal(response.body.name, 'Updated Name');
				done(error);
			});
	});

	it('can get has property', function(done) {
		request(helper.app.express)
			.get('/api/parents/' + parentID + '/list')
			.send()
			.expect(200, function(error, response) {
				assert.equal(error, null);
				assert.equal(response.body.length, 3);

				done(error);
			});
	});
});
