/* global describe, before, it */
'use strict';

var streams = require('memory-streams');
var assert = require('assert');
var path = require('path');
var Generate = require('./../lib/modules/migrations/generate');
var fs = require('fs');
var write = false;

describe('generate migrations', function() {
	var app = null;
	var basePath = path.join(__dirname, 'fixtures', 'create-migrations');

	before(function() {
		try {
			var name = require.resolve('fire');
			if(typeof require.cache[name] != 'undefined') {
				delete require.cache[name];
			}
		}
		catch(e) {
			//
		}

		var moduleName = require.resolve(basePath);
		if(typeof require.cache[moduleName] != 'undefined') {
			delete require.cache[moduleName];
		}

		var fire = require('./..');
		fire.disabled = true;
		fire.appsMap = {};

		require(path.join(basePath, 'index.js'));

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
});
