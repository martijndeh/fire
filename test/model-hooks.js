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
				return models.User.createOne({
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
				return models.User.createOne({
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
	})
});