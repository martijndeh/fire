'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Migrations = require('./../lib/migrations');
var assert = require('assert');

describe('migrations', function() {
    var models;
    var migrations;

    beforeEach(function(done) {
        models = new Models();
        models.setup(null);

        migrations = new Migrations();
        migrations.setup(null, models)
            .then(function() {
                return models.Schema.removeAll();
            })
            .then(function() {
                function FirstMigration() {}
                FirstMigration.prototype.up = function() {
                    return this.createModel('FirstTest', {
                        name: [this.String]
                    });
                };

                function SecondMigration() {}
                SecondMigration.prototype.up = function() {
                    return this.createModel('SecondTest', {
                        name: [this.String]
                    });
                };

                function ThirdMigration() {}
                ThirdMigration.prototype.up = function() {
                    return this.createModel('ThirdTest', {
                        name: [this.String]
                    });
                };

                migrations.addMigration(FirstMigration, 1);
                migrations.addMigration(SecondMigration, 2);
                migrations.addMigration(ThirdMigration, 3);

                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('can migrate once', function(done) {
        migrations.migrate(0, 1)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 1);
                done();
            })
            .done();
    })

    it('can migrate twice', function(done) {
        migrations.migrate(0, 2)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 2);
                done();
            })
            .done();
    })

    it('can migrate thrice', function() {
        migrations.migrate(0, 3)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                done();
            })
            .done();
    });

    it('can migrate to 3 rollback to 0', function() {
        migrations.migrate(0, 3)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                return assert.equal(currentVersion, 3);
            })
            .then(function() {
                return migrations.migrate(3, 0);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 0);
                done();
            })
            .done();
    });


});
