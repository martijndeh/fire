/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('knex queries', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function User(PartyModel) {
				this.name = [this.String, this.Required];
				this.parties = [this.HasMany(PartyModel), this.AutoFetch];
			}
			app.model(User);

			function Party(UserModel) {
				this.user = [this.BelongsTo(UserModel), this.Required];
				this.name = [this.String];
			}
			app.model(Party);
		};
		helper.createModels = null;
	});

	it('create select query', function(done) {
		var table = helper.app.models.User.getTable();
		var query = table.createSelectStatement({}, 1, null, null, null, null, null, 5);

		assert.notEqual(query, null);

		done();
	});
});
