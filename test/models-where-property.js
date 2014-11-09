/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models where property', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    describe('with valid where clause', function() {
        before(function() {
            helper.setup = function(app) {
                function User() {
                    this.name = [this.String];
                    this.test = [this.Where('(\'test\' = $1)')];
                }
                app.model(User);
            };

            helper.createModels = function(app) {
                return app.models.User.create({
                    name: 'Test'
                });
            };
        });

        it('can find model', function() {
            return helper.app.models.User.find({}, {})
                .then(function(users) {
                    assert.equal(users.length, 1);
                });
        });

        it('can find model with where clause', function() {
            return helper.app.models.User.find({test: 'test'}, {})
                .then(function(users) {
                    assert.equal(users.length, 1);
                });
        });

        it('cannot find model with unmatching where clause', function() {
            return helper.app.models.User.find({test: 'no match'}, {})
                .then(function(users) {
                    assert.equal(users.length, 0);
                });
        });
    });

    describe('with empty where clause', function() {
        before(function() {
            helper.setup = function(app) {
                function User() {
                    this.name = [this.String];
                    this.test = [this.Where('(1 != 1)')];
                }
                app.model(User);
            };

            helper.createModels = function(app) {
                return app.models.User.create({
                    name: 'Test'
                });
            };
        });

        it('can find model', function() {
            return helper.app.models.User.find({}, {})
                .then(function(users) {
                    assert.equal(users.length, 1);
                });
        });

        it('cannot find model', function() {
            return helper.app.models.User.find({test: true}, {})
                .then(function(users) {
                    assert.equal(users.length, 0);
                });
        });
    });
});
