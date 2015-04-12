/* global describe, before, it, after */
'use strict';

var streams = require('memory-streams');
var assert = require('assert');
var path = require('path');
var Generate = null;
var fs = require('fs');
var write = false;

describe('generate migrations', function() {
	/*
	var app = null;
	var basePath = path.join(__dirname, 'fixtures', 'create-migrations');

	after(function() {
		var firePath = path.join(__dirname, '..');

		var fire = require('./..');
		fire.disabled = false;
		fire.appsMap = {};

		// Unload Migration and Model as we swizzle methods there.
		Object.keys(require.cache).forEach(function(cacheName) {
			if(cacheName.indexOf(firePath) === 0) {
				delete require.cache[cacheName];
			}
			else {
				console.log(cacheName);
			}
		});

		var Model = require('./../lib/modules/models/model.js');

		assert.equal(null, Model.prototype.String);
	});

	before(function() {
		var firePath = path.join(__dirname, '..');

		// Unload Migration and Model as we swizzle methods there.
		Object.keys(require.cache).forEach(function(cacheName) {
			if(cacheName.indexOf(firePath) === 0) {
				delete require.cache[cacheName];
			}
			else {
				console.log(cacheName);
			}
		});

		var moduleName = require.resolve(basePath);
		if(typeof require.cache[moduleName] != 'undefined') {
			delete require.cache[moduleName];
		}

		var fire = require('./..');
		fire.disabled = true;
		fire.appsMap = {};

		require(path.join(basePath, 'index.js'));

		Generate = require('./../lib/modules/migrations/generate');

		app = fire.app('test');
	});

	it('can generate migrations', function(done) {
		var writeStream = new streams.WritableStream();
		var generate = new Generate(app, basePath);
		generate.delegate = {
			addMigration: function(fileName, stream) {
				stream.pipe(writeStream);
				stream.on('end', function() {
					if(write) {
						fs.writeFileSync(path.join(basePath, 'migration.js'), writeStream.toString());
					}

					assert.equal(writeStream.toString(), fs.readFileSync(path.join(basePath, 'migration.js')));

					done();
				});
			}
		};

		generate.createMigrations(true)
			.then(function(result) {
				assert.equal(result, true);
			});
	});
	*/
});
