/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find with association property', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	var userID = null;

	before(function() {
		helper.setup = function(app) {
			function User() {
				this.name = [this.String];
				this.events = [this.HasMany(this.models.Event)];
			}
			app.model(User);

			function App() {
				this.ignore = [this.Boolean];
				this.events = [this.HasMany(this.models.Event), this.Private];
			}
			app.model(App);

			function Event() {
				this.test = [this.String];
				this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
				this.app = [this.BelongsTo(this.models.App)];
				this.user = [this.BelongsTo(this.models.User)];
			}
			app.model(Event);
		};

		helper.createModels = function(app) {
			return Q.all([app.models.App.create({ignore: true}), app.models.User.create({name: 'Martijn'})])
				.spread(function(appModel, user) {
					userID = user.id;

					return app.models.Event.create({
						app: appModel,
						user: user
					});
				});
		};
	});

	it('can find with ignore false', function() {
		return helper.app.models.Event.find({test: null, 'app.ignore': false}, {limit:20})
			.then(function(events) {
				assert.equal(events.length, 0);
			});
	});

	it('can find with ignore true', function() {
		return helper.app.models.Event.find({test: null, 'app.ignore': true}, {limit:20})
			.then(function(events) {
				assert.equal(events.length, 1);
			});
	});

	it('can find with ignore and orderBy', function() {
		return helper.app.models.Event.find({test: null, 'app.ignore': true, user: userID}, {orderBy:{createdAt: 1}, limit: 600})
			.then(function(events) {
				assert.equal(events.length, 1);
			});
	});
});
