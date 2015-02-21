/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('triggers', function() {
	var myTriggerModelInstance, myTriggerCalled;

	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	describe('user model', function() {
		before(function() {
			helper.setup = function() {
				myTriggerModelInstance = null;
				myTriggerCalled = 0;

				function User(EventModel) {
					this.name = [this.String, this.Authenticate];
					this.events = [this.HasMany(EventModel)];
				}
				helper.app.model(User);

				function Event(UserModel) {
					this.name = [this.String];
					this.user = [this.BelongsTo(UserModel)];
				}
				helper.app.model(Event);

				function MyTrigger() {
					this.timingPattern = '* * * * * *';
				}
				helper.app.trigger(MyTrigger);

				MyTrigger.prototype.select = function() {
					return {name: 'Martijn'};
				};

				MyTrigger.prototype.run = function(user) {
					myTriggerCalled++;
					myTriggerModelInstance = user;
				};
			};

			helper.createModels = function() {
				return helper.app.models.User.create([{
					name: 'Martijn',
					password: 'test'
				}, {
					name: 'Not Martijn',
					password: 'test'
				}]);
			};
		});

		it('sets interval correctly', function() {
			assert.equal(helper.app.triggers._triggersMap.MyTrigger.timingPattern, '* * * * * *');
		});

		it('can invoke trigger', function() {
			assert.equal(myTriggerModelInstance, null);
			assert.notEqual(helper.app.triggers._triggersMap.MyTrigger, null);

			return helper.app.triggers.startConsuming()
				.then(function() {
					return helper.app.triggers.startTrigger(helper.app.triggers._triggersMap.MyTrigger)
						.then(function() {
							return Q.delay(100);
						})
						.then(function() {
							assert.notEqual(myTriggerModelInstance, null);
							assert.equal(myTriggerModelInstance.name, 'Martijn');
						});
				});
		});

		it('will not invoke trigger twice', function() {
			assert.equal(myTriggerModelInstance, null);
			assert.equal(myTriggerCalled, 0);

			return helper.app.triggers.startConsuming()
				.then(function() {
					return helper.app.triggers.startTrigger(helper.app.triggers._triggersMap.MyTrigger)
						.then(function() {
							return Q.delay(100);
						})
						.then(function() {
							assert.notEqual(myTriggerModelInstance, null);

							assert.equal(myTriggerCalled, 1);
							assert.equal(myTriggerModelInstance.name, 'Martijn');
						})
						.then(function() {
							return helper.app.triggers.startTrigger(helper.app.triggers._triggersMap.MyTrigger);
						})
						.then(function() {
							return Q.delay(100);
						})
						.then(function() {
							assert.equal(myTriggerCalled, 1);
							assert.equal(myTriggerModelInstance.name, 'Martijn');
						});
				});
		});
	});

	describe('test model', function() {
		before(function() {
			helper.setup = function() {
				myTriggerModelInstance = null;
				myTriggerCalled = 0;

				function Test() {
					this.name = [this.String, this.Authenticate];
				}
				helper.app.model(Test);

				function MyTrigger() {
					//
				}
				helper.app.trigger(MyTrigger);

				MyTrigger.prototype.select = function() {
					return {name: 'Martijn'};
				};

				MyTrigger.prototype.run = function(test) {
					myTriggerCalled++;
					myTriggerModelInstance = test;
				};
			};

			helper.createModels = function() {
				return helper.app.models.Test.create([{
					name: 'Martijn',
					password: 'test'
				}, {
					name: 'Not Martijn',
					password: 'test'
				}]);
			};
		});

		it('can invoke trigger', function() {
			assert.equal(myTriggerModelInstance, null);
			assert.notEqual(helper.app.triggers._triggersMap.MyTrigger, null);

			return helper.app.triggers.startConsuming()
				.then(function() {
					return helper.app.triggers.startTrigger(helper.app.triggers._triggersMap.MyTrigger)
						.then(function() {
							return Q.delay(100);
						})
						.then(function() {
							assert.notEqual(myTriggerModelInstance, null);
							assert.equal(myTriggerModelInstance.name, 'Martijn');
						});
				});			
		});
	});
});
