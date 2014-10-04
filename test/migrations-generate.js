/* global describe, before, it, beforeEach, afterEach */
var fire = require('..');

var assert = require('assert');
var path = require('path');
var streams = require('memory-streams');
var Generate = require('./../lib/modules/migrations/generate');
var fs = require('fs');
var PropertyTypes = require('./../lib/modules/models/property-types');
var Model = require('./../lib/modules/models/model');

describe('migrations generate', function() {
    /*
    var app = null;
    var createModels = null;

    beforeEach(function(done) {
        app = fire.app('', {
            disabled: true
        });

        if(createModels) {
            createModels();
        }

        app.start()
            .then(function() {
                done();
            })
            .done();
    });

    afterEach(function(done) {
        Object.keys(PropertyTypes).forEach(function(propertyName) {
            Model.prototype[propertyName] = PropertyTypes[propertyName];
        });

        app.stop()
            .then(function() {
                done();
            });
    });

    describe('access control', function() {
        before(function() {
            createModels = function() {
                function Test() {
                    this.name = [this.String, this.CanUpdate('test')];
                }
                app.model(Test);
            };
        });

        it('can generate update access control migration', function(done) {
            var writeStream = new streams.WritableStream();

            var generate = new Generate(null);
            generate.delegate = {
                addMigration: function(fileName, stream) {
                    assert.equal(fileName, '001-create-initial-schema.js');

                    stream.pipe(writeStream);
                    stream.on('end', function() {
                        assert.equal(writeStream.toString(), fs.readFileSync(path.join(__dirname, 'fixtures', 'migrations', '001-create-initial-schema.js')));
                        done();
                    });
                }
            };
            generate.createMigrations();
        });
    });
    */
});
