/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('model instance many to many', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function ProjectUserUserProject(UserModel, ProjectModel) {
				this.user = [this.BelongsTo(UserModel), this.Required];
				this.project = [this.BelongsTo(ProjectModel), this.Required];
			}
			app.model(ProjectUserUserProject);

			function User() {
				this.name = [this.String];
				this.projects = [this.HasMany(this.models.Project, {
					through: this.models.ProjectUserUserProject
				}), this.AutoFetch];
			}
			app.model(User);

			function Project() {
				this.name = [this.String];
				this.users = [this.HasMany(this.models.User, {
					through: this.models.ProjectUserUserProject
				})];
			}
			app.model(Project);

			helper.modelNames = ['User', 'Project', 'ProjectUserUserProject'];
		};

		helper.createModels = function(app) {
			return app.models.User.create({name: 'Test 1'})
				.then(function(user) {
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
					return app.models.Project.findOne({name: 'Project 1'});
				})
				.then(function(project) {
					return project.addUsers([
						{
							name: 'Test 2'
						},
						{
							name: 'Test 3'
						}
					]);
				})
				.then(function() {
					return app.models.Project.create({
						name: 'Project 4'
					});
				})
				.then(function() {
					return app.models.User.create({
						name: 'Test 4'
					});
				});
		};
	});

	it('can get plural', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.getProjects();
			})
			.then(function(projects) {
				assert.equal(projects.length, 3);

				done();
			});
	});

	it('can get plural using where map', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.getProjects({name: 'Project 1'});
			})
			.then(function(projects) {
				assert.equal(projects.length, 1);

				done();
			});
	});

	it('can find singular', function(done) {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.findUser({name: 'Test 2'});
			})
			.then(function(user) {
				assert.notEqual(user, null);
				assert.equal(user.name, 'Test 2');
				done();
			});
	});

	it('cannot find unrelated singular', function(done) {
		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				return project.findUser({name: 'Test 4'});
			})
			.then(function(user) {
				assert.equal(user, null);
				done();
			});
	});

	it('can add singular with create map', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.addProject({name: 'Project 5'})
					.then(function(project) {
						assert.notEqual(project, null);
						assert.equal(project.name, 'Project 5');

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 4);
				done();
			});
	});

	it('can add singular with model instance', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.addProject(helper.app.models.Project.findOne({name: 'Project 4'}))
					.then(function(project) {
						assert.notEqual(project, null);
						assert.equal(project.name, 'Project 4');

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 4);
				done();
			});
	});

	it('can add singular with id', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return helper.app.models.Project.findOne({name: 'Project 4'})
					.then(function(project) {
						assert.notEqual(project, null);

						return user.addProject(project.id);
					})
					.then(function(projectUUID) {
						assert.notEqual(projectUUID, null);
						assert.equal(typeof projectUUID, 'string');

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 4);
				done();
			});
	});

	it('can remove singular with model instance', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.findProject({name: 'Project 1'})
					.then(function(project) {
						return user.removeProject(project);
					})
					.then(function(projectsUsers) {
						assert.notEqual(projectsUsers, null);

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 2);
				done();
			})
			.done();
	});

	it('can remove singular with uuid', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.findProject({name: 'Project 1'})
					.then(function(project) {
						return user.removeProject(project.id);
					})
					.then(function(projectsUsers) {
						assert.notEqual(projectsUsers, null);

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 2);
				done();
			})
			.done();
	});

	it('can remove all', function(done) {
		return helper.app.models.User.findOne({name: 'Test 1'})
			.then(function(user) {
				return user.removeAllProjects()
					.then(function(usersProjects) {
						assert.equal(usersProjects.length, 3);

						return user.getProjects();
					});
			})
			.then(function(projects) {
				assert.equal(projects.length, 0);

				return helper.app.models.Project.findOne({name: 'Project 1'});
			})
			.then(function(project) {
				assert.notEqual(project, null);
				done();
			})
			.done();
	});
});
