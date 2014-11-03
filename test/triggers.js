/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('triggers', function() {
	/*
	var myTriggerModelInstance = null;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			myTriggerModelInstance = null;

			function User() {
				this.name = [this.String, this.Authenticate];
				this.events = [this.HasMany(this.models.Event)];
			}
			helper.app.model(User);

			function Event() {
				this.name = [this.String];
				this.user = [this.BelongsTo(this.models.User)];
			}
			helper.app.model(Event);

			function MyTrigger() {
				this.on = 'User.create';
			}
			helper.app.trigger(MyTrigger);

			MyTrigger.prototype.when = function(modelInstance) {
				return (modelInstance.name == 'Martijn');
			};

			MyTrigger.prototype.run = function(modelInstance) {
				if(this.when(modelInstance)) {
					myTriggerModelInstance = modelInstance;

					return this.activate(modelInstance.id, {
						persistent: true,
						resetAt: new Date()
					});
				}
			};
		};
		helper.createModels = null;
	});

	it('can invoke trigger', function() {
		assert.equal(myTriggerModelInstance, null);

		return helper.app.models.User.create({
			name: 'Martijn',
			password: 'test'
		})
		.then(function() {
			return Q.delay(100);
		})
		.then(function() {
			assert.notEqual(myTriggerModelInstance, null);
			assert.equal(myTriggerModelInstance.name, 'Martijn');
		});
	});

	it('will not invoke trigger', function() {
		assert.equal(myTriggerModelInstance, null);

		return helper.app.models.User.create({
			name: 'Not Martijn',
			password: 'test'
		})
		.then(function() {
			return Q.delay(100);
		})
		.then(function() {
			assert.equal(myTriggerModelInstance, null);
		});
	});

	// will only fire once, option to reset trigger, timeout
	*/
});
