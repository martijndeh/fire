/* global describe, beforeEach, afterEach, before, it */
'use strict';

var assert = require('assert');
var helper = require('./support/helper');
var Migrations = require('./../lib/modules/migrations');

describe('migrations execute', function() {
	var migrations = null;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Test() {
				this.value = [this.Integer, this.Required];
			}
			app.model(Test);
		};

		helper.createModels = function() {
			return helper.app.models.Test.create({value: 1})
				.then(function() {
					migrations = new Migrations();
					return migrations.setup(null, helper.app.models)
						.then(function() {
							return helper.app.models.Schema.removeAll();
						});
				});
		};
	});

	it('can call execute task once per migration', function() {
		function Migration1() {}
		Migration1.prototype.up = function() {
			this.models.execute('UPDATE tests SET value = value + 1');
		};

		Migration1.prototype.down = function() {
			this.models.execute('UPDATE tests SET value = value - 1');
		};

		migrations.addMigration(Migration1, 1);

		function Migration2() {}
		Migration2.prototype.up = function() {
			this.models.execute('UPDATE tests SET value = value + 1');
		};

		Migration2.prototype.down = function() {
			this.models.execute('UPDATE tests SET value = value - 1');
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
				return helper.app.models.Test.findOne({});
			})
			.then(function(test) {
				assert.equal(test.value, 2);
			});
	});
});
