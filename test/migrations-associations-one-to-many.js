'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Model = require('./../lib/model');
var Migrations = require('./../lib/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations-associations-one-to-many', function() {

	var models;
    var migrations;

    afterEach(function(done) {
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
                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('can create 1:N association', function(done) {
    	function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                b: [this.BelongsTo(this.models.B)]
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

    it('can query relationships', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.Id],
                name: [this.String],
                b: [this.BelongsTo(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.Id],
                name: [this.String],
                as: [this.HasMany(this.models.A), this.AutoFetch]
            });         
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.B.createOne({
                    name: 'Bert'
                });
            })
            .then(function(b) {
                var result = Q.when(true);

                for(var i = 0; i < 10; i++) {
                    result = result.then(function() {
                        return models.A.createOne({
                            name: 'Aart',
                            b: b
                        });
                    });
                }

                return result;
            })
            .then(function() {
                return models.B.findOne({name:'Bert'});
            })
            .then(function(b) {
                assert.equal(b.as.length, 10);

                for(var i = 0, il = 10; i < il; i++) {
                    var a = b.as[i];
                    assert.equal(a.name, 'Aart');
                }

                return done();
            })
            .fail(function(error) {
                done(error);
            });
    });
});