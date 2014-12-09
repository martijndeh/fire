/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');

describe('models remove many-to-many', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			app.models.Project = 'Project';
			app.models.Tag = 'Tag';

			function Project() {
				this.name = [this.String];
				this.tags = [this.HasMany(this.models.Tag)];

				this.accessControl = [this.CanDelete(function() {
					return true;
				})];
			}
			app.model(Project);

			function Tag() {
				this.name = [this.String];
				this.projects = [this.HasMany(this.models.Project)];
			}
			app.model(Tag);
		};

		helper.createModels = function(app) {
			return Q.all([
				app.models.Project.create([{name: 'Project 1'}, {name: 'Project 2'}]),
				app.models.Tag.create([{name: 'Tag 1'}, {name: 'Tag 2'}]),
			]).spread(function(projects, tags) {
				assert.equal(tags.length, 2);
				assert.equal(projects.length, 2);

				return Q.all([
					tags[0].addProject(projects[0]),
					tags[0].addProject(projects[1]),
					projects[0].addTag(tags[0]),
					projects[0].addTag(tags[1])
				]);
			});
		};
	});

	it('can remove many-to-many association', function() {
		function deleteProjectTag(projectID, tagID) {
			var defer = Q.defer();

			request(helper.app.HTTPServer.express)
				.delete('/api/projects/' + projectID + '/tags/' + tagID)
				.expect(200, function(error) {
					if(error) {
						defer.reject(error);
					}
					else {
						defer.resolve();
					}
				});
			return defer.promise;
		}

		return helper.app.models.Project.findOne({name: 'Project 1'})
			.then(function(project) {
				assert.notEqual(project, null);

				return project.getTags()
					.then(function(tags) {
						assert.equal(tags.length, 2);

						return deleteProjectTag(project.id, tags[0].id);
					})
					.then(function() {
						return project.getTags();
					})
					.then(function(tags) {
						assert.equal(tags.length, 1);
					});
			});
	});
});
