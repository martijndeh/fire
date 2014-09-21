/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var uuid = require('node-uuid');

describe('model instance one to one', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function User() {
				this.name = [this.String];
				this.project = [this.HasOne(this.models.Project), this.AutoFetch];
			}
			app.model(User);

			function Project() {
				this.name = [this.String];
				this.user = [this.BelongsTo(this.models.User), this.AutoFetch];
			}
			app.model(Project);
		};

		helper.createModels = function(app) {
			return app.models.User.create({
					name: 'Martijn'
				})
				.then(function(user) {
					return app.models.Project.create({
						name: 'Project 1',
						user: user
					});
				})
				.then(function() {
					return app.models.User.create({
						name: 'User Without Project'
					});
				})
				.then(function() {
					return app.models.Project.create({
						name: 'Project Without User'
					});
				});
		};
	});

	it('can set one to null on belongs to', function() {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.setUser(null);
			})
			.then(function() {
				return helper.app.models.Project.findOne({name: 'Project 1'});
			})
			.then(function(project) {
				assert.equal(project.user, null);
			});
	});

	it('can set one to null on has one', function() {
		return helper.app.models.User.findOne({name: 'Martijn'})
			.then(function(user) {
				assert.equal(user.project.name, 'Project 1');
				return user.setProject(null);
			})
			.then(function() {
				return helper.app.models.User.findOne({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.project, null);
			});
	});

	it('can remove one on has one', function() {
		return helper.app.models.User.findOne({name: 'Martijn'})
			.then(function(user) {
				return user.removeProject();
			})
			.then(function(project) {
				assert.equal(project.user, null);
				return helper.app.models.User.findOne({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.project, null);
			});
	});
});
