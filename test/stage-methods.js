/* global describe, beforeEach, before, afterEach, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('stage methods', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function() {
			//
		};

		helper.createModels = function() {
			//
		};
	});

	it('methods exist', function() {
		assert.notEqual(typeof helper.app.build, 'undefined');
		assert.notEqual(typeof helper.app.release, 'undefined');
		assert.notEqual(typeof helper.app.run, 'undefined');
	});

	it('can execute build methods', function() {
		var called = false;

		helper.app.build(function test() {
			called = true;
		});

		helper.app.stageMethods.disable('build:uglify');
		helper.app.stageMethods.disable('build:less');
		helper.app.stageMethods.disable('build:templates');
		helper.app.stageMethods.disable('build:browserify');
		helper.app.stageMethods.disable('build:api');
		helper.app.stageMethods.disable('build:scripts');
		helper.app.stageMethods.disable('build:migrations');
		helper.app.stageMethods.disable('build:procfile');
		helper.app.stageMethods.disable('build:version');

		return helper.app.stageMethods.build()
			.then(function() {
				assert.equal(called, true);
			});
	});

	it('can disable method', function() {
		var called = false;

		helper.app.build(function test() {
			called = true;
		});

		helper.app.stageMethods.disable('build:uglify');
		helper.app.stageMethods.disable('build:less');
		helper.app.stageMethods.disable('build:templates');
		helper.app.stageMethods.disable('build:browserify');
		helper.app.stageMethods.disable('build:api');
		helper.app.stageMethods.disable('build:scripts');
		helper.app.stageMethods.disable('build:migrations');
		helper.app.stageMethods.disable('build:procfile');
		helper.app.stageMethods.disable('build:version');

		helper.app.stageMethods.disable('build:test');

		return helper.app.stageMethods.build()
			.then(function() {
				assert.equal(called, false);
			});
	});
});
