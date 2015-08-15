'use strict';

var app = require('fire')('streams', {
	modules: ['angular-route'],
	NODE_ENV: process.env.NODE_ENV
});

/**
 * Let's create a simple Item model with a name and karma points.
 *
 * We'll also include two methods to change the karma points and save the changes.
 */
app.model(function Item() {
	this.name = [this.String, this.Required];
	this.karma = [this.Integer, this.Required];

	this.increaseKarma = function() {
		this.karma = this.karma + 1;
		return this.save();
	};

	this.decreaseKarma = function() {
		this.karma = this.karma - 1;
		return this.save();
	};
});

/**
 * In the release stage, let's create a couple of test items. This function is invoked when calling `fire release`. You can also call it directly by calling `fire release:createItems`.
 */
app.release(function createItems(ItemModel) {
	return ItemModel.count()
		.then(function(count) {
			if(count === 0) {
				return ItemModel.create([{
					name: 'John',
					karma: 0
				}, {
					name: 'Jack',
					karma: 0
				}, {
					name: 'Jones',
					karma: 0
				}, {
					name: 'Jess',
					karma: 10
				}]);
			}
		});
});

/**
 * We create two streams:
 *
 * 	1) All items with 10 or more karma points.
 *  2) All items with less than 10 karma points.
 *
 * In `templates/start.jade`, which is the template of our Start controller, we list the two streams.
 *
 * Go ahead and run `fire serve` to start this example app. Make sure you have a database configured (or create one via `fire datastore:create streams`).
 */
app.controller('/', function StartController($scope, ItemModel) {
	$scope.goodItems = ItemModel.stream({karma:{$gte: 10}});
	$scope.badItems = ItemModel.stream({karma:{$lt: 10}});

	$scope.goodItems.on('changed', function(item) {
		console.log('Item changed (in >= 10):');
		console.log(item);
	});

	$scope.badItems.on('changed', function(item) {
		console.log('Item changed (in < 10):');
		console.log(item);
	});
});
