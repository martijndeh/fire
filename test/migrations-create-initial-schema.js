'use strict';

var fire = require('..');
var Models = require('./../lib/modules/models/models');
var Model = require('./../lib/modules/models/model');
var Migrations = require('./../lib/modules/migrations/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations create initial schema', function() {
	var models = null;
    var migrations = null;
    var app = null;

    afterEach(function(done) {
        // We should drop everything
        migrations.destroyAllModels()
        .then(function() {
            return app.stop();
        })
        .then(function() {
        	done();
        })
        .fail(function(error) {
            done(error);
        })
        .done();
    });

    beforeEach(function(done) {
    	app = fire.app();
    	app.run()
    		.then(function() {
		        models = app.models;

		        migrations = new Migrations();
		        migrations.setup(null, models)
		            .then(function() {
		                return models.Schema.removeAll();
		            })
		            .then(function() {
		                done();
		            })
		            .fail(function(error) {
		                done(error);
		            })
		            .done();
	        });
    });

	it('creating many related models', function(done) {
		function Migration() {}

		Migration.prototype.up = function() {
			this.models.createModel('Activity', {
				id: [this.Id],
				user: [this.BelongsTo(this.models.User)],
				app: [this.BelongsTo(this.models.App), this.AutoFetch],
				name: [this.Text],
				createdAt: [this.DateTime]
			});
			this.models.createModel('App', {
				id: [this.Id],
				name: [this.Text],
				bundleIdentifier: [this.Text],
				activities: [this.HasMany(this.models.Activity)]
			});
			this.models.createModel('Client', {
				id: [this.Id],
				name: [this.String],
				projects: [this.HasMany(this.models.Project), this.AutoFetch],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
			this.models.createModel('Project', {
				id: [this.Id],
				name: [this.String],
				client: [this.BelongsTo(this.models.Client)],
				timeTracks: [this.HasMany(this.models.TimeTrack)]
			});
			this.models.createModel('Team', {
				id: [this.Id],
				name: [this.String],
				clients: [this.HasMany(this.models.Client)],
				users: [this.HasMany(this.models.User)]
			});
			this.models.createModel('TimeTrack', {
				id: [this.Id],
				name: [this.String],
				startedAt: [this.DateTime, this.Required],
				endedAt: [this.DateTime],
				project: [this.BelongsTo(this.models.Project)],
				user: [this.BelongsTo(this.models.User), this.Required]
			});
			this.models.createModel('User', {
				id: [this.Id],
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

		migrations.migrate(0, 1)
			.then(function() {
				return migrations.currentVersion();
			})
			.then(function(currentVersion) {
				return assert.equal(currentVersion, 1);
			})
			.then(done)
			.fail(done)
			.done();
	})

	it('can destroy all models', function(done) {
		function Migration() {}

		Migration.prototype.up = function() {
			this.models.createModel('Activity', {
				id: [this.Id],
				user: [this.BelongsTo(this.models.User)],
				app: [this.BelongsTo(this.models.App), this.AutoFetch],
				name: [this.Text],
				createdAt: [this.DateTime]
			});
			this.models.createModel('App', {
				id: [this.Id],
				name: [this.Text],
				bundleIdentifier: [this.Text],
				activities: [this.HasMany(this.models.Activity)]
			});
			this.models.createModel('Client', {
				id: [this.Id],
				name: [this.String],
				projects: [this.HasMany(this.models.Project), this.AutoFetch],
				team: [this.BelongsTo(this.models.Team), this.Required]
			});
			this.models.createModel('Project', {
				id: [this.Id],
				name: [this.String],
				client: [this.BelongsTo(this.models.Client)],
				timeTracks: [this.HasMany(this.models.TimeTrack)]
			});
			this.models.createModel('Team', {
				id: [this.Id],
				name: [this.String],
				clients: [this.HasMany(this.models.Client)],
				users: [this.HasMany(this.models.User)]
			});
			this.models.createModel('TimeTrack', {
				id: [this.Id],
				name: [this.String],
				startedAt: [this.DateTime, this.Required],
				endedAt: [this.DateTime],
				project: [this.BelongsTo(this.models.Project)],
				user: [this.BelongsTo(this.models.User), this.Required]
			});
			this.models.createModel('User', {
				id: [this.Id],
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

		migrations.migrate(0, 1)
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
			})
			.then(done)
			.fail(done)
			.done();
	})
});