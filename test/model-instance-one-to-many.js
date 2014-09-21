/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var uuid = require('node-uuid');

describe('model instance one to many', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	var user = null;

	before(function() {
		helper.setup = function(app) {
			function User() {
				this.name = [this.String];
				this.projects = [this.HasMany(this.models.Project), this.AutoFetch];
			}
			app.model(User);

			function Project() {
				this.name = [this.String];
				this.user = [this.BelongsTo(this.models.User)];
			}
			app.model(Project);
		};

		helper.createModels = function(app) {
			return app.models.User.create({
					name: 'Martijn'
				})
				.then(function(user_) {
					user = user_;

					return user.addProjects([
						{
							name: 'Project 1'
						},
						{
							name: 'Project 2'
						},
						{
							name: 'Project 3'
						}
					]);
				})
				.then(function() {
					return app.models.Project.create({
						name: 'Project 4'
					});
				});
		};
	});

	it('can get plural', function() {
		return user.getProjects()
			.then(function(projects) {
				assert.equal(projects.length, 3);
			});
	});

	it('can get plural with where map', function() {
		return user.getProjects({name: 'Project 1'})
			.then(function(projects) {
				assert.equal(projects.length, 1);
			});
	});

	it('cannot get unrelated plural with where map', function() {
		return user.getProjects({name: 'Project 4'})
			.then(function(projects) {
				assert.equal(projects.length, 0);
			});
	});

	it('can find singular', function() {
		return user.findProject({name: 'Does Not Exist'})
			.then(function(project) {
				assert.equal(project, null);
			});
	});
	it('can get singular', function() {
		return user.getProject({name: 'Project 1'})
			.then(function(project) {
				assert.notEqual(project, null);
				assert.equal(project.name, 'Project 1');
			});
	});

	it('can add singular with create map', function() {
		return user.addProject({name: 'Project 5'})
			.then(function(project) {
				assert.notEqual(project, null);

				return user.findProject({name: 'Project 5'});
			})
			.then(function(project) {
				assert.notEqual(project, null);
				assert.equal(project.name, 'Project 5');
				return project.getUser();
			})
			.then(function(projectUser) {
				assert.equal(projectUser.id, user.id);
			});
	});

	it('can add via create', function() {
		return helper.app.models.Project.create({
				name: 'Project 5',
				user: user
			})
			.then(function(project) {
				assert.notEqual(project, null);
				return user.getProjects();
			})
			.then(function(projects) {
				assert.equal(projects.length, 4);
			});
	});

	it('can remove singular', function() {
		return user.removeProject({name: 'Project 1'})
			.then(function(project) {
				assert.equal(project.name, 'Project 1');
			});
	});

	it('can set one via method (user on project)', function() {
		return helper.app.models.Project.findOne({name: 'Project 4'})
			.then(function(project) {
				return project.setUser(user);
			})
			.then(function(project) {
				assert.equal(project.user, user.id);
				return user.getProjects();
			})
			.then(function(projects) {
				assert.equal(projects.length, 4);
			});
	});

	it('can remove one (user from project)', function() {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.removeUser();
			});
	});

	it('can get one', function() {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.getUser();
			})
			.then(function(projectUser) {
				assert.equal(projectUser.id, user.id);
			});
	});

	it('can find one', function() {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.findUser();
			})
			.then(function(projectUser) {
				assert.equal(projectUser.id, user.id);
			});
	});
});
