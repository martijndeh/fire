/* global describe, beforeEach, afterEach, before, it */
'use strict';

var assert = require('assert');
var helper = require('./support/helper');
var Migrations = require('./../lib/modules/migrations');

describe('migrations update function', function() {
	var migrations = null;

	beforeEach(helper.beforeEach({
		migrate: true
	}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Shoe() {
				this.value = [this.Integer, this.Required];
			}
			app.model(Shoe);
		};

		helper.createModels = function() {
			return helper.app.models.Shoe.create({value: 1})
				.then(function() {
					migrations = new Migrations(helper.app, helper.app.models);
					return migrations.setup(null)
						.then(function() {
							return helper.app.models.Schema.removeAll();
						})
						.catch(function(error) {
							console.log(error);
						});
				});
		};
	});

	it('can migrate up', function() {
		function Migration1() {}
		Migration1.prototype.up = function() {
			this.models.execute('UPDATE shoes SET value = value + 1');
			this.models.Shoe.updateFunction({}, function(shoe) {
				shoe.value = shoe.value + 1;
			});
		};

		Migration1.prototype.down = function() {
			this.models.execute('UPDATE shoes SET value = value - 1');
			this.models.Shoe.updateFunction({}, function(shoe) {
				shoe.value = shoe.value - 1;
			});
		};

		migrations.addMigration(Migration1, 1);

		function Migration2() {}
		Migration2.prototype.up = function() {
			this.models.execute('UPDATE shoes SET value = 5');
			this.models.Shoe.updateFunction({value: 5}, function(shoe) {
				shoe.value = shoe.value + 5;
			});
		};

		Migration2.prototype.down = function() {
			this.models.Shoe.updateFunction({value: 10}, function(shoe) {
				shoe.value = shoe.value - 5;
			});
			this.models.execute('UPDATE shoes SET value = 1 WHERE value = 5');
		};

		migrations.addMigration(Migration2, 2);

		return migrations.migrate(1, 2)
			.then(function() {
				return migrations.currentVersion();
			})
			.then(function(currentVersion) {
				return assert.equal(currentVersion, 2);
			})
			.then(function() {
				return helper.app.models.Shoe.findOne({});
			})
			.then(function(shoe) {
				assert.equal(shoe.value, 10);
			});
	});
});
