'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Model = require('./../lib/model');
var assert = require('assert');
var Q = require('q');

describe('model hooks', function() {
	var models;
    beforeEach(function(done) {
        models = new Models();
        models.setup(null)
            .then(function() {
                done();
            })
            .done();
    });

    afterEach(function(done) {
        // TODO: We should drop everything in beforeEach instead.
        // But make sure we don't drop /everything/: only whatever the tests use
        // We don't want to delete any real tables because of a misconfiguration

        var result = Q.when(true);

        models.forEach(function(model) {
            result = result.then(function() {
                return model.exists().then(function(exists) {
                    if(exists) {
                        return model.forceDestroy();
                    }
                    else {
                        return Q.when(true);
                    }
                });
            });
        });

        result.then(function() {
            models = null;
            done();
        })
        .done();
    });

	it('can set property in beforeCreate', function(done) {
		function User() {
			this.testName = [this.String];
			this.testValue = [this.Integer, this.Required];
		}
		User.prototype.beforeCreate = function() {
			var self = this;
			return Q.delay(1).then(function() {
				self.testValue = 123;
			});
		};

		models.addModel(User);

		models.User.setup()
			.then(function() {
				return models.User.create({
					testName: 'Martijn'
				});
			})
			.then(function(user) {
				assert.equal(user.testValue, 123);
				return models.User.findOne({testName: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.testValue, 123);

				user.testValue = 124;
				return user.save();
			})
			.then(function(user) {
				assert.equal(user.testValue, 124);
				done();
			})
			.done();
	});

	it('can set property in beforeSave', function(done) {
		function User() {
			this.testName = [this.String];
			this.testValue = [this.Integer, this.Required];
		}
		User.prototype.beforeSave = function() {
			var self = this;
			return Q.delay(1).then(function() {
				self.testValue = 111;
			});
		};

		models.addModel(User);

		models.User.setup()
			.then(function() {
				return models.User.create({
					testName: 'Martijn'
				});
			})
			.then(function(user) {
				assert.equal(user.testValue, 111);

				user.testValue = 123;
				return user.save();
			})
			.then(function(user) {
				assert.equal(user.testValue, 111);
				done();
			})
			.done();
	});

	it('can set relation in beforeCreate', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}

		User.prototype.beforeCreate = function() {
			var self = this;
			return self.models.Team.create({name:'First Team'})
				.then(function(team) {
					self.team = team;
					return true;
				});
		}

		models.addModel(Team);
		models.addModel(User);

		return models.Team.setup()
			.then(function() {
				return models.User.setup();
			})
			.then(function() {
				return models.User.create({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.id, 1);
				assert.equal(user.name, 'Martijn');
				assert.notEqual(user.team, null);
				assert.equal(user.team.id, 1);
				assert.equal(user.team.name, 'First Team');

				return done();
			})
			.fail(done)
			.done();
	});

	it('can set promise in beforeCreate', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}

		User.prototype.beforeCreate = function() {
			this.team = this.models.Team.create({name: 'Created in -beforeCreate'});
		}

		models.addModel(Team);
		models.addModel(User);

		return models.Team.setup()
			.then(function() {
				return models.User.setup();
			})
			.then(function() {
				return models.User.create({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.id, 1);
				assert.equal(user.name, 'Martijn');
				assert.notEqual(user.team, null);
				assert.equal(user.team.id, 1);
				assert.equal(user.team.name, 'Created in -beforeCreate');

				return done();
			})
			.fail(done)
			.done();
	})

	it('cannot create user when set promise gets rejected', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}

		User.prototype._createTeam = function() {
			var defer = Q.defer();

			defer.reject(new Error('Cannot create team'));

			return defer.promise;
		};

		User.prototype.beforeCreate = function() {
			this.team = this._createTeam();
		}

		models.addModel(Team);
		models.addModel(User);

		return models.Team.setup()
			.then(function() {
				return models.User.setup();
			})
			.then(function() {
				return models.User.create({name: 'Martijn'})
					.then(function() {
						return null;	
					})
					.fail(function(error) {
						return error;
					});
			})
			.then(function(error) {
				assert.notEqual(error, null);
				assert.equal(error.message, 'Cannot create team');

				return models.User.find();
			})
			.then(function(users) {
				assert.equal(users.length, 0);
				return done();
			})
			.fail(done)
			.done();
	})
});