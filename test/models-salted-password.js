/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var crypto = require('crypto');

describe('models salted password', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function User() {
                this.email = [this.String, this.Authenticate, this.Unique];
            }
            app.model(User);
        };

        helper.createModels = function(app) {
            return app.models.User.create({
                email: 'Martijn',
                password: 'password'
            });
        };
    });

    it('can create salt', function() {
        return helper.app.models.User.findOne({})
            .then(function(user) {
                assert.notEqual(null, user);
                assert.notEqual(user.passwordSalt, null);
                assert.equal(user.passwordSalt.length, 256);
            });
    });

    it('creates saltes password', function() {
        return helper.app.models.User.findOne({})
            .then(function(user) {
                var hash = crypto.createHash('sha512');
                hash.update('password');
                hash.update(user.passwordSalt);

                assert.equal(user.password, hash.digest('hex'));
            });
    });

    it('creates proper password', function() {
        return helper.app.models.User.findOne({})
            .then(function(user) {
                var hash = crypto.createHash('sha512');
                hash.update('something');
                hash.update(user.passwordSalt);

                assert.notEqual(user.password, hash.digest('hex'));
            });
    });

    it('can find authenticator', function() {
        return helper.app.models.User.findOne({email: 'Martijn'})
            .then(function(user) {
                assert.notEqual(user, null);

                return user.validateHash('password', 'password')
                    .then(function(result) {
                        assert.equal(result, true);
                        return user.validateHash('password', 'not my password');
                    })
                    .then(function(result) {
                        assert.equal(result, false);
                    });
            });
    });

    it('may not use hash in where map', function() {
        assert.throws(function() {
            return helper.app.models.User.find({email: 'Martijn', password: 'password'});
        }, function(error) {
            return (error.toString() === 'Error: Property `password` contains a hash method. It is not possible to query on a hash method directly.');
        });
    });

    it('can update password', function() {
        return helper.app.models.User.updateOne({email: 'Martijn'}, {password: 'test'})
            .then(function(user) {
                return user.validateHash('password', 'test');
            })
            .then(function(result) {
                assert.equal(result, true);
            });
    });
});
