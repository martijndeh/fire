'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Model = require('./../lib/model');
var Migrations = require('./../lib/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations', function() {
    var models;
    var migrations;

    afterEach(function(done) {
        // We should drop everything
        migrations.destroyAllModels()
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

                function Migration9() {}
                Migration9.prototype.up = function() {
                    this.models.ThirdTest.addProperties({
                        clients: [this.Many(this.models.Client), this.AutoFetch()]
                    });
                }
                Migration9.prototype.down = function() {
                    this.models.ThirdTest.removeProperties(['clients']);
                }

                function Migration10() {}
                Migration10.prototype.up = function() {
                    this.models.ThirdTest.addProperties({
                        type: [this.String, this.Default('\'Test\'')]
                    });

                    this.models.ThirdTest.update({}, {type:'Not a Test'});
                }
                Migration10.prototype.down = function() {
                    this.models.ThirdTest.removeProperties(['type']);
                }

                function Migration11() {}
                Migration11.prototype.up = function() {
                    this.models.createModel('TestRelation', {
                        name: [this.String],
                        thirdTests: [this.AutoFetch(), this.Many(this.models.ThirdTest)]
                    });
                };
                Migration11.prototype.down = function() {
                    this.models.destroyModel('TestRelation');
                }

                migrations.addMigration(FirstMigration, 1);
                migrations.addMigration(SecondMigration, 2);
                migrations.addMigration(ThirdMigration, 3);
                migrations.addMigration(FourthMigration, 4);
                migrations.addMigration(FifthMigration, 5);
                migrations.addMigration(SixthMigration, 6);
                migrations.addMigration(Migration7, 7);
                migrations.addMigration(Migration8, 8);
                migrations.addMigration(Migration9, 9);
                migrations.addMigration(Migration10, 10);
                migrations.addMigration(Migration11, 11);

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
                return migrations.resetAllModels();
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
                return migrations.resetAllModels();
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
                return migrations.resetAllModels();
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

    it('can implicitly edit model', function(done) {
        migrations.migrate(0, 8)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 8);
                done();
            })
            .done();
    });

    it('can implicitly edit model without affecting actual model', function(done) {
        migrations.migrate(0, 9)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 9);
                done();
            })
            .done();
    });

    it('can migrate and execute query', function(done) {
        migrations.migrate(0, 9)
            .then(function() {
                return models.ThirdTest.createOne({name:'Test 1'});
            })
            .then(function() {
                return migrations.resetAllModels();
            })
            .then(function() {
                return migrations.migrate(9, 10);
            })
            .then(function() {
                return models.ThirdTest.createOne({name:'Test 2'});
            })
            .then(function() {
                return models.ThirdTest.find({});
            })
            .then(function(tests) {
                assert.equal(tests.length, 2);

                assert.equal(tests[0].id, 1);
                assert.equal(tests[0].name, 'Test 1');
                assert.equal(tests[0].type, 'Not a Test');

                assert.equal(tests[1].id, 2);
                assert.equal(tests[1].name, 'Test 2');
                assert.equal(tests[1].type, 'Test');

                return migrations.resetAllModels();
            })
            .then(function() {
                return migrations.migrate(10, 6);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 6);
                done();
            })
            .done();
    })

    it('can create model and add many association', function(done) {
        migrations.migrate(0, 11)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 11);
                return done();
            })
            .done();
    })
});
