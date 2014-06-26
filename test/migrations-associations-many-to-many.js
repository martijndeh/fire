'use strict';

var fire = require('..');

var Models = require('./../lib/modules/models/models');
var Model = require('./../lib/modules/models/model');
var Migrations = require('./../lib/modules/migrations/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations-associations-many-to-many', function() {
    var app = null;
	var models = null;
    var migrations = null;

    afterEach(function(done) {
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
            })
            .fail(function(error) {
                console.log(error);
                done(error);
            })
    });

    it('can create model with multiple associations', function(done) {
        function Migration() {
            //
        }

        Migration.prototype.up = function() {
            this.models.createModel('User', {
                id: [this.Id],
                name: [this.String, this.Required],
                articles: [this.HasMany(this.models.Article, "submitter")],
                votes: [this.HasMany(this.models.Article, "voters")]
            });
            this.models.createModel('Article', {
                id: [this.Id],
                title: [this.String, this.Required],
                url: [this.String, this.Required],
                createdAt: [this.DateTime, this.Default("CURRENT_DATE")],
                submitter: [this.BelongsTo(this.models.User, "articles"), this.Required, this.AutoFetch],
                voters: [this.HasMany(this.models.User, "votes")]
            });
        };

        Migration.prototype.down = function() {
            this.models.destroyModel('User');
            this.models.destroyModel('Article');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                assert.notEqual(models.ArticlesUsers, null);
                return models.ArticlesUsers.exists();
            })
            .then(function(exists) {
                assert.equal(exists, true);
                done();
            })
            .fail(function(error) {
                done(error);
            });
    })

    it('can create model with M:N association', function(done) {
    	function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            });
    });

    it('can create instances with M:N association', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                assert.equal(a.name, 'Aart');
                assert.equal(typeof a.getBs, 'function');
                assert.equal(typeof a.getB, 'undefined');
                assert.equal(typeof a.bs, 'undefined');
                assert.equal(typeof a.addB, 'function');
                assert.equal(typeof a.removeB, 'function');

                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        assert.equal(b.name, 'Bert');
                        assert.equal(typeof b.getAs, 'function');
                        assert.equal(typeof b.getA, 'undefined');
                        assert.equal(typeof b.as, 'undefined');
                        assert.equal(typeof b.addA, 'function');
                        assert.equal(typeof b.removeA, 'function');

                        return b.addA(a)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return b.getAs();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 1);

                                return b.removeA(a);
                            })
                            .then(function(association) {
                                return b.getAs();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 0);

                                return a.addB(b);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return a.getBs();
                            })
                            .then(function(bs) {
                                assert.notEqual(bs, null);
                                assert.equal(bs.length, 1);
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            });
    });

    it('can create M:N relationships with unrelated names', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                manyKey1: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                manyKey2: [this.HasMany(this.models.A)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                assert.equal(a.name, 'Aart');
                assert.equal(typeof a.getManyKey1s, 'function');
                assert.equal(typeof a.manyKey1, 'undefined');
                assert.equal(typeof a.manyKey1s, 'undefined');
                assert.equal(typeof a.addManyKey1, 'function');
                assert.equal(typeof a.removeManyKey1, 'function');

                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        assert.equal(b.name, 'Bert');
                        assert.equal(typeof b.getManyKey2s, 'function');
                        assert.equal(typeof b.manyKey2, 'undefined');
                        assert.equal(typeof b.manyKey2s, 'undefined');
                        assert.equal(typeof b.addManyKey2, 'function');
                        assert.equal(typeof b.removeManyKey2, 'function');

                        return b.addManyKey2(a)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return b.getManyKey2s();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 1);
                                assert.equal(as[0].name, 'Aart');

                                return b.removeManyKey2(a);
                            })
                            .then(function(association) {
                                return b.getManyKey2s();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 0);

                                return a.addManyKey1(b);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return a.getManyKey1s();
                            })
                            .then(function(bs) {
                                assert.notEqual(bs, null);
                                assert.equal(bs.length, 1);
                                assert.equal(bs[0].name, 'Bert');
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('cannot add invalid associations', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        b.addA({id:123})
                            .then(function() {
                                // This should happen ... obviously
                                assert.equal(1, 2);
                            })
                            .fail(function(error) {
                                assert.notEqual(error, null);
                            })
                            .then(function() {
                                return b.getAs()
                            })
                            .then(function(as) {
                                assert.equal(as.length, 0);
                                return true;
                            })
                    });
            })
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('can query relationships with find', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        var names = [
            'Aart 1',
            'Aart 2',
            'Aart 3',
            'Aart 4',
            'Aart 5',
            'Adrian 1',
            'Adrian 2',
            'Adrian 3',
            'Adrian 4',
            'Adrian 5',
        ];

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                var result = Q.when(true);

                names.forEach(function(name) {
                    result = result.then(function() {
                        return models.A.create({name: name});
                    });
                });

                return result;
            })
            .spread(function(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        var result = Q.when(true);

                        result = result.then(function() { return b.addA(models.A.findOne({name:names[0]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[1]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[2]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[3]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[4]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[5]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[6]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[7]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[8]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[9]})); });

                        return result.then(function() {
                            return b.getAs({id:{$gt:5}});
                        });
                    });
            })
            .then(function(as) {
                assert.equal(as.length, 5);

                assert.equal(as[0].name, 'Adrian 1');
                assert.equal(as[1].name, 'Adrian 2');
                assert.equal(as[2].name, 'Adrian 3');
                assert.equal(as[3].name, 'Adrian 4');
                assert.equal(as[4].name, 'Adrian 5');
                return true;
            })
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('can create model with M:N association using different names', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('C', {
                id: [this.Id],
                name: [this.String],
                ds: [this.HasMany(this.models.D)]
            });

            this.models.createModel('D', {
                id: [this.Id],
                name: [this.String],
                cs: [this.HasMany(this.models.C)]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('C');
            this.models.destroyModel('D');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.C.create({
                    name: 'Cees'
                });
            })
            .then(function(c) {
                assert.equal(c.name, 'Cees');

                return models.D
                    .create({
                        name: 'Dirk'
                    })
                    .then(function(d) {
                        assert.equal(d.name, 'Dirk');

                        return d.addC(c)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return d.getCs();
                            })
                            .then(function(cs) {
                                assert.notEqual(cs, null);
                                assert.equal(cs.length, 1);

                                return d.removeC(c);
                            })
                            .then(function(association) {
                                return d.getCs();
                            })
                            .then(function(cs) {
                                assert.notEqual(cs, null);
                                assert.equal(cs.length, 0);

                                return c.addD(d);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return c.getDs();
                            })
                            .then(function(ds) {
                                assert.notEqual(ds, null);
                                assert.equal(ds.length, 1);
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .fail(function(error) {
                done(error);
            });
    });
});