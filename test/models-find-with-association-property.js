/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find with association property', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function App() {
				this.ignore = [this.Boolean];
				this.events = [this.HasMany(this.models.Event), this.Private];
			}
			app.model(App);

			function Event() {
				this.test = [this.String];
				this.app = [this.BelongsTo(this.models.App)];
			}
			app.model(Event);
		};

		helper.createModels = function(app) {
			return app.models.App.create({ignore: true})
				.then(function(appModel) {
					return app.models.Event.create({
						app: appModel
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
});
