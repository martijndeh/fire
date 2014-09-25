/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models many to many', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function User() {
				this.name = [this.String];
				this.followers = [this.HasMany(this.models.User, 'followings')];
				this.followings = [this.HasMany(this.models.User, 'followers')];
			}
			app.model(User);
		};

		helper.createModels = function() {
			//
		};
	});

	it('can create follower', function() {
		return helper.app.models.User.create([{
				name: 'Martijn'
			}, {
				name: 'Follower'
			}])
			.then(function(users) {
				assert.equal(users.length, 2);
				assert.equal(users[0].name, 'Martijn');
				assert.equal(users[1].name, 'Follower');

				return users[0].addFollower(users[1]);
			})
			.then(function() {
				return helper.app.models.User.findOne({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.name, 'Martijn');

				return user.getFollowers();
			})
			.then(function(followers) {
				assert.notEqual(followers, null);
				assert.equal(followers.length, 1);
				assert.equal(followers[0].name, 'Follower');
			});
	});

	it('can create following', function() {
		return helper.app.models.User.create([{
				name: 'Martijn'
			}, {
				name: 'Follower'
			}])
			.then(function(users) {
				assert.equal(users.length, 2);
				assert.equal(users[0].name, 'Martijn');
				assert.equal(users[1].name, 'Follower');

				return users[0].addFollowing(users[1]);
			})
			.then(function() {
				return helper.app.models.User.findOne({name: 'Martijn'});
			})
			.then(function(user) {
				assert.equal(user.name, 'Martijn');

				return user.getFollowings();
			})
			.then(function(followings) {
				assert.notEqual(followings, null);
				assert.equal(followings.length, 1);
				assert.equal(followings[0].name, 'Follower');
			});
	});
});
