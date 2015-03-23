/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var Q = require('q');

describe('model hooks', function() {
	var models = null;
	var app = null;

    beforeEach(function(done) {
    	app = fire.app('hooks', {});
        fire.start()
            .then(function() {
            	models = app.models;

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

            return fire.stop();
        })
        .then(function() {
        	done();
        })
        .done();
    });

	it('can set property in beforeCreate', function(done) {
		function User() {
			this.testName = [this.String];
			this.testValue = [this.Integer, this.Required];
		}
		app.model(User);

		User.prototype.beforeCreate = function() {
			var self = this;
			return Q.delay(1).then(function() {
				self.testValue = 123;
			});
		};

		setImmediate(function() {
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
	});

	it('can set property in beforeSave', function(done) {
		function User() {
			this.testName = [this.String];
			this.testValue = [this.Integer, this.Required];
		}
		app.model(User);

		User.prototype.beforeSave = function() {
			var self = this;
			return Q.delay(1).then(function() {
				self.testValue = 111;
			});
		};

		setImmediate(function() {
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
	});

	it('can set relation in beforeCreate', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}
		app.model(Team);

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}
		app.model(User);

		User.prototype.beforeCreate = function() {
			var self = this;
			return self.models.Team.create({name:'First Team'})
				.then(function(team) {
					self.team = team;
					return true;
				});
		}

		setImmediate(function() {
			return models.Team.setup()
				.then(function() {
					return models.User.setup();
				})
				.then(function() {
					return models.User.create({name: 'Martijn'});
				})
				.then(function(user) {
					assert.equal(user.name, 'Martijn');
					assert.notEqual(user.team, null);
					assert.equal(user.team.name, 'First Team');

					return done();
				})
				.catch(done)
				.done();
		});
	});

	it('can set promise in beforeCreate', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}
		app.model(Team);

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}
		app.model(User);

		User.prototype.beforeCreate = function() {
			this.team = this.models.Team.create({name: 'Created in -beforeCreate'});
		}

		setImmediate(function() {
			return models.Team.setup()
				.then(function() {
					return models.User.setup();
				})
				.then(function() {
					return models.User.create({name: 'Martijn'});
				})
				.then(function(user) {
					assert.equal(user.name, 'Martijn');
					assert.notEqual(user.team, null);
					assert.equal(user.team.name, 'Created in -beforeCreate');

					return done();
				})
				.catch(done)
				.done();
		});
	})

	it('cannot create user when set promise gets rejected', function(done) {
		function Team() {
			this.name = [this.String];
			this.users = [this.HasMany(this.models.User)];
		}
		app.model(Team);

		function User() {
			this.name = [this.String];
			this.team = [this.BelongsTo(this.models.Team), this.Required, this.AutoFetch];
		}
		app.model(User);

		User.prototype._createTeam = function() {
			var defer = Q.defer();

			defer.reject(new Error('Cannot create team'));

			return defer.promise;
		};

		User.prototype.beforeCreate = function() {
			this.team = this._createTeam();
		}

		setImmediate(function() {
			return models.Team.setup()
				.then(function() {
					return models.User.setup();
				})
				.then(function() {
					return models.User.create({name: 'Martijn'})
						.then(function() {
							return null;
						})
						.catch(function(error) {
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
				.catch(done)
				.done();
		});
	});

	it('will call afterUpdate', function(done) {
		var called = 0;

		function User() {
			this.name = [this.String];
		}
		app.model(User);

		User.prototype.afterUpdate = function() {
			called++;
		};

		setImmediate(function() {
			models.User.setup()
				.then(function() {
					return models.User.create({name: 'Martijn'});
				})
				.then(function() {
					return models.User.update({name: 'Martijn'}, {name: 'Weird Guy'});
				})
				.then(function(users) {
					assert.equal(users.length, 1);
					assert.equal(called, 1);
					done();
				})
				.catch(function(error) {
					done(error);
				})
				.done();
		});
	});

	it('will call afterUpdate zero times', function(done) {
		var called = 0;

		function User() {
			this.name = [this.String];
		}
		app.model(User);

		User.prototype.afterUpdate = function() {
			called++;
		};

		setImmediate(function() {
			models.User.setup()
				.then(function() {
					return models.User.create({name: 'Someone Else'});
				})
				.then(function() {
					return models.User.update({name: 'Martijn'}, {name: 'Weird Guy'});
				})
				.then(function(users) {
					assert.equal(users.length, 0);
					assert.equal(called, 0);
					done();
				})
				.done();
		});
	});

	it('will call afterUpdate three times', function(done) {
		var called = 0;

		function User() {
			this.name = [this.String];
		}
		app.model(User);

		User.prototype.afterUpdate = function() {
			called++;
		};

		setImmediate(function() {
			models.User.setup()
				.then(function() {
					return models.User.create([{name: 'Someone Else'}, {name: 'Another Guy'}, {name: 'Martijn Again'}]);
				})
				.then(function() {
					return models.User.update({}, {name: 'Weird Guy'});
				})
				.then(function(users) {
					assert.equal(users.length, 3);
					assert.equal(called, 3);
					done();
				})
				.done();
		});
	});

	it('will call afterUpdate after ModelInstance#save', function(done) {
		var called = 0;

		function User() {
			this.name = [this.String];
		}
		app.model(User);

		User.prototype.afterUpdate = function() {
			called++;
		};

		setImmediate(function() {
			models.User.setup()
				.then(function() {
					return models.User.create({name: 'Martijn'});
				})
				.then(function() {
					return models.User.findOne({});
				})
				.then(function(user) {
					user.name = 'Test';
					return user.save();
				})
				.then(function() {
					assert.equal(called, 1);
					done();
				})
				.done();
		});
	});

	it('will call afterSave', function(done) {
		var called = 0;

		function User() {
			this.name = [this.String];
		}
		app.model(User);

		User.prototype.afterSave = function() {
			called++;
		};

		setImmediate(function() {
			models.User.setup()
				.then(function() {
					return models.User.create({name: 'Martijn'});
				})
				.then(function() {
					return models.User.update({name: 'Martijn'}, {name: 'Weird Guy'});
				})
				.then(function(users) {
					assert.equal(users.length, 1);
					return Q.delay(0);
				})
				.then(function() {
					assert.equal(called, 2);
					done();
				})
				.catch(function(error) {
					done(error);
				})
				.done();
		});
	});
});
