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
			}
			app.model(Parent);

			Parent.prototype.accessControl = function() {
				return {
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true
				};
			};

			function Child() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
			}
			app.model(Child);

			Child.prototype.accessControl = function() {
				return {
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true
				};
			};

			function Private() {
				this.name = [this.String];
				this.parent = [this.BelongsTo(this.models.Parent)];
			}
			app.model(Private);

			function User() {
				this.name 			= [this.String, this.Unique];
			}
			app.model(User);

			User.prototype.accessControl = function() {
				return {
					canCreate: false,
					canUpdate: false
				};
			};

			function Article() {
				this.title 			= [this.String, this.Required];
				this.location = [this.HasOne(this.models.ArticleLocation)];
			}
			app.model(Article);

			Article.prototype.accessControl = function() {
				return {
					canCreate: false,
					canRead: true,
					canUpdate: true,
					canDelete: true
				};
			};

			function ArticleLocation() {
				this.article = [this.BelongsTo(this.models.Article)];
				this.latitude = [this.Integer];
				this.longitude = [this.Integer];
			}
			app.model(ArticleLocation);

			ArticleLocation.prototype.accessControl = function() {
				return {
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true
				};
			};
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
				})
				.then(function() {
					return app.models.ArticleLocation.create({
						article: article1ID,
						latitude: 1,
						longitude: 2
					});
				});
		};
	});

	it('can find many', function(done) {
		request(helper.app.HTTPServer.express)
			.get('/api/parents/' + parentID + '/childs')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.length, 3);
				done(error);
			});
	});

	it('can create one-to-many', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/parents/' + parentID + '/childs')
			.send({
				name: 'New Child'
			})
			.expect(200, function(error) {
				done(error);
			});
	});

	it('can delete one-to-many', function(done) {
		request(helper.app.HTTPServer.express)
			.delete('/api/parents/' + parentID + '/childs/' + child1ID)
			.send()
			.expect(200, function(error) {
				done(error);
			});
	});

	it('can update one-to-many', function(done) {
		request(helper.app.HTTPServer.express)
			.put('/api/parents/' + parentID + '/childs/' + child1ID)
			.send({
				name: 'Updated Child Name'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.name, 'Updated Child Name');
				done(error);
			});
	});

	it('cannot find private many', function(done) {
		request(helper.app.HTTPServer.express)
			.get('/api/parents/' + parentID + '/privates')
			.send()
			.expect(404, function(error) {
				done(error);
			});
	});

	it('can update one', function(done) {
		request(helper.app.HTTPServer.express)
			.put('/api/parents/' + parentID + '/childs/' + child1ID)
			.send({
				name: 'Updated Name'
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.id, child1ID);
				assert.equal(response.body.name, 'Updated Name');
				done(error);
			});
	});

	it('can find one-to-one property', function(done) {
		request(helper.app.HTTPServer.express)
			.get('/api/articles/' + article1ID + '/location')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.article, article1ID);

				done(error);
			});
	});

	it('can create one-to-one property', function(done) {
		request(helper.app.HTTPServer.express)
			.post('/api/articles/' + article2ID + '/location')
			.send({
				latitude: 3,
				longitude: 4
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.article, article2ID);
				done(error);
			});
	});

	it('can remove one-to-one property', function(done) {
		request(helper.app.HTTPServer.express)
			.delete('/api/articles/' + article1ID + '/location')
			.send()
			.expect(200, function(error, response) {
				assert.equal(response.body.article, article1ID);
				done(error);
			});
	});

	it('can update one-to-one property', function(done) {
		request(helper.app.HTTPServer.express)
			.put('/api/articles/' + article1ID + '/location')
			.send({
				latitude: 5
			})
			.expect(200, function(error, response) {
				assert.equal(response.body.article, article1ID);
				assert.equal(response.body.latitude, 5);

				done(error);
			});
	});
});
