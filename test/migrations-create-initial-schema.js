/* global it, describe, afterEach, beforeEach */
'use strict';

var fire = require('..');
var Migrations = require('./../lib/modules/migrations');
var assert = require('assert');

describe('migrations create initial schema', function() {
	var models = null;
    var migrations = null;
    var app = null;

    afterEach(function(done) {
        // We should drop everything
        migrations.destroyAllModels()
        .then(function() {
            return fire.stop();
        })
        .then(function() {
        	done();
        })
        .catch(function(error) {
            done(error);
        })
        .done();
    });

	beforeEach(function() {
		app = fire.app('migrations', {});

		app.modules.forEach(function(module_) {
			if(module_.migrate) {
				module_.migrate(app.models);
			}
		});

		return fire.start()
			.then(function() {
				models = app.models;

				migrations = new Migrations(app, models);
				return migrations.setup(null)
					.then(function() {
						return models.Schema.isCreated()
							.then(function(exists) {
								return !exists && models.Schema.setup();
							});
					})
					.then(function() {
						return models.Schema.removeAll();
					});
			});
	});

	it('creating many related models', function() {
		function Migration() {}

		Migration.prototype.up = function() {
			this.models.createModel('Activity', {
				id: [this.UUID],
				user: [this.BelongsTo(this.models.User)],
				app: [this.BelongsTo(this.models.App), this.AutoFetch],
				name: [this.Text],
				createdAt: [this.DateTime]
			});
			this.models.createModel('App', {
				id: [this.UUID],
				name: [this.Text],
				bundleIdentifier: [this.Text],
				activities: [this.HasMany(this.models.Activity)]
			});
			this.models.createModel('Client', {
				id: [this.UUID],
				name: [this.String],
				projects: [this.HasMany(this.models.Project), this.AutoFetch],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
			this.models.createModel('Project', {
				id: [this.UUID],
				name: [this.String],
				client: [this.BelongsTo(this.models.Client)],
				timeTracks: [this.HasMany(this.models.TimeTrack)]
			});
			this.models.createModel('Team', {
				id: [this.UUID],
				name: [this.String],
				clients: [this.HasMany(this.models.Client)],
				users: [this.HasMany(this.models.User)]
			});
			this.models.createModel('TimeTrack', {
				id: [this.UUID],
				name: [this.String],
				startedAt: [this.DateTime, this.Required],
				endedAt: [this.DateTime],
				project: [this.BelongsTo(this.models.Project)],
				user: [this.BelongsTo(this.models.User), this.Required]
			});
			this.models.createModel('User', {
				id: [this.UUID],
				name: [this.Text],
				accessToken: [this.Text],
				email: [this.Text],
				activities: [this.HasMany(this.models.Activity)],
				timeTracks: [this.HasMany(this.models.TimeTrack)],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
		};

		Migration.prototype.down = function() {
			this.models.destroyModel('Activity');
			this.models.destroyModel('App');
			this.models.destroyModel('Client');
			this.models.destroyModel('Project');
			this.models.destroyModel('Team');
			this.models.destroyModel('TimeTrack');
			this.models.destroyModel('User');
			this.models.destroyModel('Schema');
		};

		migrations.addMigration(Migration, 1);

		return migrations.migrate(0, 1)
			.then(function() {
				return migrations.currentVersion();
			})
			.then(function(currentVersion) {
				return assert.equal(currentVersion, 1);
			});
	});

	it('can destroy all models', function() {
		function Migration() {}

		Migration.prototype.up = function() {
			this.models.createModel('Activity', {
				id: [this.UUID],
				user: [this.BelongsTo(this.models.User)],
				app: [this.BelongsTo(this.models.App), this.AutoFetch],
				name: [this.Text],
				createdAt: [this.DateTime]
			});
			this.models.createModel('App', {
				id: [this.UUID],
				name: [this.Text],
				bundleIdentifier: [this.Text],
				activities: [this.HasMany(this.models.Activity)]
			});
			this.models.createModel('Client', {
				id: [this.UUID],
				name: [this.String],
				projects: [this.HasMany(this.models.Project), this.AutoFetch],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
			this.models.createModel('Project', {
				id: [this.UUID],
				name: [this.String],
				client: [this.BelongsTo(this.models.Client)],
				timeTracks: [this.HasMany(this.models.TimeTrack)]
			});
			this.models.createModel('Team', {
				id: [this.UUID],
				name: [this.String],
				clients: [this.HasMany(this.models.Client)],
				users: [this.HasMany(this.models.User)]
			});
			this.models.createModel('TimeTrack', {
				id: [this.UUID],
				name: [this.String],
				startedAt: [this.DateTime, this.Required],
				endedAt: [this.DateTime],
				project: [this.BelongsTo(this.models.Project)],
				user: [this.BelongsTo(this.models.User), this.Required]
			});
			this.models.createModel('User', {
				id: [this.UUID],
				name: [this.Text],
				accessToken: [this.Text],
				email: [this.Text],
				activities: [this.HasMany(this.models.Activity)],
				timeTracks: [this.HasMany(this.models.TimeTrack)],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
		};

		Migration.prototype.down = function() {
			this.models.destroyModel('Activity');
			this.models.destroyModel('App');
			this.models.destroyModel('Client');
			this.models.destroyModel('Project');
			this.models.destroyModel('Team');
			this.models.destroyModel('TimeTrack');
			this.models.destroyModel('User');
		};

		migrations.addMigration(Migration, 1);

		return migrations.migrate(0, 1)
			.then(function() {
				return migrations.currentVersion();
			})
			.then(function(currentVersion) {
				return assert.equal(currentVersion, 1);
			})
			.then(function() {
				return migrations.resetAllModels();
			})
			.then(function() {
				return migrations.migrate(1, 0);
			})
			.then(function() {
				return migrations.currentVersion();
			})
			.then(function(currentVersion) {
				return assert.equal(currentVersion, 0);
			});
	});
});
