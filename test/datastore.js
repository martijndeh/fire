/* global describe, beforeEach, before, afterEach */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('datastore', function() {
	beforeEach(helper.beforeEach({migrate: true}));
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			//
		};

		helper.createModels = function() {
			//
		};
	});

	helper.test('can query 50 times', function() {
		var numberOfQueries = 0;
		var count = 100;
		var results = [];

		while(count--) {
			results.push(helper.app.models.datastore.rawQuery('SELECT 1')
					.then(function(result) {
						numberOfQueries++;
						return result;
					})); //jshint ignore:line
		}

		return Q.all(results)
			.then(function() {
				assert.equal(numberOfQueries, 100);
			});
	});
});
