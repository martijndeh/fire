/* global Migrations */
'use strict';

var fire = require('..');
var Migrations = require('./../lib/modules/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations', function() {
    var models = null;
    var app = null;
    var migrations = null;

    afterEach(function() {
        return migrations.destroyAllModels()
            .then(function() {
                return fire.stop();
            })
            .then(function() {
                var defer = Q.defer();
                app.models.datastore.knex.destroy(defer.makeNodeResolver());
                return defer.promise;
            });
    });

    beforeEach(function(done) {

        app = fire.app('migrations', {});

        app.modules.forEach(function(module_) {
            if(module_.migrate) {
                module_.migrate(app.models);
            }
        });

        fire.start()
            .then(function() {
                models = app.models;

                migrations = new Migrations(app, models);
                migrations.setup(null)
                    .then(function() {
                        return models.Schema.exists()
                            .then(function(exists) {
                                return !exists && models.Schema.setup();
                            });
                    })
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
                                user: [this.HasOne(this.models.User)]
                            });

                            this.models.User.addProperties({
                                thirdTest: [this.BelongsTo(this.models.ThirdTest)]
                            });
                        }
                        SixthMigration.prototype.down = function() {
                            this.models.ThirdTest.removeProperties(['user']);
                            this.models.User.removeProperties(['thirdTest']);
                        }

                        function Migration7() {}
                        Migration7.prototype.up = function() {
                            this.models.createModel('Project', {
                                name: [this.String],
                                client: [this.BelongsTo(this.models.Client)]
                            });

                            this.models.createModel('Client', {
                                name: [this.String],
                                projects: [this.HasMany(this.models.Project), this.AutoFetch]
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
                                clients: [this.HasMany(this.models.Client), this.AutoFetch]
                            });
                            this.models.Client.addProperties({
                                workspace: [this.BelongsTo(this.models.Workspace)]
                            });
                        };

                        Migration8.prototype.down = function() {
                            this.models.Client.removeProperties(['workspace']);
                            this.models.destroyModel('Workspace');
                        }

                        function Migration9() {}
                        Migration9.prototype.up = function() {
                            this.models.ThirdTest.addProperties({
                                clients: [this.HasMany(this.models.Client), this.AutoFetch()]
                            });

                            this.models.Client.addProperties({
                                thirdTest: [this.BelongsTo(this.models.Client)]
                            });
                        }
                        Migration9.prototype.down = function() {
                            this.models.ThirdTest.removeProperties(['clients']);
                            this.models.Client.removeProperties(['thirdTest']);
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
                                thirdTests: [this.AutoFetch, this.HasMany(this.models.ThirdTest)]
                            });

                            this.models.ThirdTest.addProperties({
                                testRelation: [this.BelongsTo(this.models.TestRelation)]
                            });
                        };
                        Migration11.prototype.down = function() {
                            this.models.ThirdTest.removeProperties(['testRelation'])
                            this.models.destroyModel('TestRelation');
                        }

                        function Migration12() {}
                        Migration12.prototype.up = function() {
                            this.models.Project.addProperties({
                                team: [this.HasOne(this.models.Team)]
                            })
                            this.models.createModel('Team', {
                                id: [this.UUID],
                                name: [this.String],
                                project: [this.BelongsTo(this.models.Project), this.Required]
                            });
                        }
                        Migration12.prototype.down = function() {
                            this.models.Project.removeProperties(['team']);
                            this.models.destroyModel('Team');
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
                        migrations.addMigration(Migration12, 12);

                        done();
                    })
                    .catch(function(error) {
                        done(error);
                    })
                    .done();
        });
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
                return models.ThirdTest.create({
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
                return models.ThirdTest.create({name:'Test 1'});
            })
            .then(function() {
                return migrations.resetAllModels();
            })
            .then(function() {
                return migrations.migrate(9, 10);
            })
            .then(function() {
                return models.ThirdTest.create({name:'Test 2'});
            })
            .then(function() {
                return models.ThirdTest.find({}, {orderBy:{name:1}});
            })
            .then(function(tests) {
                assert.equal(tests.length, 2);

                assert.equal(tests[0].name, 'Test 1');
                assert.equal(tests[0].type, 'Not a Test');

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
    });

    it('can add one-reference and create model afterwards', function(done) {
         migrations.migrate(0, 12)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 12);
                return done();
            })
            .done();
    });

    it('can rollback migrations', function(done) {
        function Migration13() {}
        Migration13.prototype.up = function() {
            this.models.createModel('TestModel', {
                id: [this.UUID],
                name: [this.String]
            });
            this.models.execute('SELCT * FROM test_models FROM 1');
        }
        Migration13.prototype.down = function() {
            this.models.Project.removeProperties(['team']);
            this.models.destroyModel('TestModel');
        }

        migrations.addMigration(Migration13, 13);

        migrations.migrate(0, 13)
            .catch(function(error) {
                assert.equal(error.toString(), 'error: syntax error at or near "SELCT"');
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                // The migration should fail, so we check a lower version number
                assert.equal(currentVersion, 12);

                return models.execute('SELECT * FROM test_models');
            })
            .catch(function(error) {
                assert.equal(error.toString(), 'error: relation "test_models" does not exist');
                return done();
            })
            .done();
    });

    it('can create required reference via has many', function(done) {
        function Migration13() {}
        Migration13.prototype.up = function() {
            this.models.createModel('TestChild', {
                id: [this.UUID],
                name: [this.String],
                parent: [this.BelongsTo(this.models.TestParent), this.Required]
            });

            this.models.createModel('TestParent', {
                id: [this.UUID],
                name: [this.String],
                childs: [this.HasMany(this.models.TestChild)]
            });
        }
        Migration13.prototype.down = function() {
            this.models.destroyModel('TestParent');
            this.models.destroyModel('TestChild');
        }

        migrations.addMigration(Migration13, 13);

        migrations.migrate(0, 13)
            .then(function() {
                return models.TestChild.create({
                    name: "This should fail as we're not setting a parent"
                });
            })
            .catch(function(error) {
                assert.equal(error.toString(), 'error: null value in column "parent_id" violates not-null constraint');
                done();
            })
            .done();
    });
});
