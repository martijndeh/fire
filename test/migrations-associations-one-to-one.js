'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Model = require('./../lib/model');
var Migrations = require('./../lib/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations associations one-to-one', function() {

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

    it('can create 1:1 association', function(done) {
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
    			a: [this.HasOne(this.models.A)]
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

	it('can query 1:1 association', function(done) {
    	function Migration() {}
    	Migration.prototype.up = function() {
			this.models.createModel('B', {
    			id: [this.Id],
    			name: [this.String],
    			a: [this.HasOne(this.models.A)]
    		});  

    		this.models.createModel('A', {
    			id: [this.Id],
    			name: [this.String],
    			b: [this.BelongsTo(this.models.B), this.AutoFetch]
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
    			assert.notEqual(b, null);
    			return models.A.createOne({
    				name: 'Aart',
    				b: b
    			});
    		})
    		.then(function(a) {
    			assert.notEqual(a, null);
    			return models.A.findOne({});
    		})
    		.then(function(a) {
    			assert.notEqual(a, null);
    			assert.equal(a.name, 'Aart');
    			assert.notEqual(a.b, null);
    			assert.equal(a.b.name, 'Bert');

    			// Even though .b exists--an accessor method should also be available
    			return a.getB();
    		})
    		.then(function(b) {
    			assert.notEqual(b, null);
    			assert.equal(b.name, 'Bert');

    			return done();
    		})
    		.fail(function(error) {
    			done(error);
    		})
    		.done();
    });

	it('can create 1:1 auto fetched association', function(done) {
    	function Migration() {}
    	Migration.prototype.up = function() {
			this.models.createModel('B', {
    			id: [this.Id],
    			name: [this.String],
    			a: [this.HasOne(this.models.A)]
    		});  

    		this.models.createModel('A', {
    			id: [this.Id],
    			name: [this.String],
    			b: [this.BelongsTo(this.models.B), this.AutoFetch]
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
    			assert.notEqual(b, null);
    			return models.A.createOne({
    				name: 'Aart',
    				b: b
    			});
    		})
    		.then(function(a) {
    			assert.notEqual(a, null);
    			return models.A.findOne({});
    		})
    		.then(function(a) {
    			assert.notEqual(a, null);
    			assert.equal(a.name, 'Aart');
    			assert.notEqual(a.b, null);
    			assert.equal(a.b.name, 'Bert');
    			
    			return models.B.findOne({});
    		})
    		.then(function(b) {
    			assert.notEqual(b, null);
    			assert.equal(b.name, 'Bert');

    			// We did not specify an auto-fetch--so this should be available
    			assert.equal(b.a, null);

    			return b.getA();
    		})
    		.then(function(a) {
    			assert.notEqual(a, null);
    			assert.equal(a.name, 'Aart');
    			return done();
    		})
    		.fail(function(error) {
    			done(error);
    		})
    		.done();
    });
});