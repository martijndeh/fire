'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Migrations = require('./../lib/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations', function() {
    var models;
    var migrations;

    afterEach(function(done) {
        // We should drop everything
        Q.all([
            models.Schema && models.Schema.destroy(),
            models.FirstTest && models.FirstTest.destroy(),
            models.SecondTest && models.SecondTest.destroy(),
            models.ThirdTest && models.ThirdTest.destroy()
        ])
        .then(function() {
            return models.User && models.User.destroy();
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
                    this.models.createModel('FirstTest', {
                        name: [this.String]
                    });
                };
                FirstMigration.prototype.down = function() {
                    this.models.destroyModel('FirstTest');
                };

                function SecondMigration() {}
                SecondMigration.prototype.up = function() {
                    this.models.createModel('SecondTest', {
                        name: [this.String]
                    });
                };
                SecondMigration.prototype.down = function() {
                    this.models.destroyModel('SecondTest');
                };

                function ThirdMigration() {}
                ThirdMigration.prototype.up = function() {
                    this.models.createModel('ThirdTest', {
                        name: [this.String]
                    });
                };
                ThirdMigration.prototype.down = function() {
                    this.models.destroyModel('ThirdTest');
                };

                function FourthMigration() {}
                FourthMigration.prototype.up = function() {
                    this.models.ThirdTest.addProperties({
                        value: [this.Integer]
                    });
                }
                FourthMigration.prototype.down = function() {
                    this.models.ThirdTest.removeProperties(['value']);
                }

                function FifthMigration() {}
                FifthMigration.prototype.up = function() {
                    this.models.createModel('User', {
                        name: [this.String]
                    });
                }
                FifthMigration.prototype.down = function() {
                    this.models.destroyModel('User');
                }

                function SixthMigration() {}
                SixthMigration.prototype.up = function() {
                    this.models.ThirdTest.addProperties({
                        user: [this.Reference(this.models.User)]
                    });
                }
                SixthMigration.prototype.down = function() {
                    this.models.ThirdTest.removeProperties(['user']);
                }

                function Migration7() {}
                Migration7.prototype.up = function() {
                    this.models.createModel('Project', {
                        name: [this.String]
                    });

                    this.models.createModel('Client', {
                        name: [this.String],
                        projects: [this.Many(this.models.Project), this.AutoFetch()]
                    });
                };

                Migration7.prototype.down = function() {
                    this.models.destroyModel('Project');
                    this.models.destroyModel('Client');
                }

                function Migration8() {}
                Migration8.prototype.up = function() {
                    this.models.createModel('Workspace', {
                        name: [this.String],
                        clients: [this.Many(this.models.Client), this.AutoFetch()]
                    });
                };

                Migration8.prototype.down = function() {
                    this.models.destroyModel('Workspace');
                }

                migrations.addMigration(FirstMigration, 1);
                migrations.addMigration(SecondMigration, 2);
                migrations.addMigration(ThirdMigration, 3);
                migrations.addMigration(FourthMigration, 4);
                migrations.addMigration(FifthMigration, 5);
                migrations.addMigration(SixthMigration, 6);
                migrations.addMigration(Migration7, 7);
                migrations.addMigration(Migration8, 8);

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

    it('can migrate thrice', function(done) {
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

    it('can migrate to 3 rollback to 0', function(done) {
        migrations.migrate(0, 3)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                return true;
            })
            .then(function() {
                // Let's clear all the models
                models['FirstTest'] = null;
                models['SecondTest'] = null;
                models['ThirdTest'] = null;
                return true;
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

    it('can edit existing models', function(done) {
        migrations.migrate(0, 4)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 4);
                return true;
            })
            .then(function() {
                return models.ThirdTest.createOne({
                    name: 'Test :-)',
                    value: 123
                });
            })
            .then(function(model) {
                return assert.equal(model.value, 123);
            })
            .then(function() {
                // Let's clear all the models
                models.FirstTest = null;
                models.SecondTest = null;
                models.ThirdTest = null;
                return true;
            })
            .then(function() {
                return migrations.migrate(4, 3);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                done();
            })
            .done();
    });

    it('can add relation', function(done) {
        migrations.migrate(0, 6)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 6);
                return true;
            })
            .then(function() {
                // Let's clear all the models
                models.FirstTest = null;
                models.SecondTest = null;
                models.ThirdTest = null;
                models.User = null;
                return true;
            })
            .then(function() {
                return migrations.migrate(6, 0);
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

    it('can create many assocation', function(done) {
        migrations.migrate(0, 7)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 7);
                return true;
            })
            .then(function() {
                // Let's clear all the models
                models.FirstTest = null;
                models.SecondTest = null;
                models.ThirdTest = null;
                models.User = null;
                models.Project = null;
                models.Client = null;
                return true;
            })
            .then(function() {
                return migrations.migrate(7, 4);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 4);
                done();
            })
            .done();
    });
});
