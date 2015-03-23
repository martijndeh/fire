/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models update', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Shoe() {
                this.name = [this.String];
                this.position = [this.Integer];
            }
            app.model(Shoe);
        };

        helper.createModels = function(app) {
            return app.models.Shoe.create([{
                name: 'Test 1',
                position: 0
            }, {
                name: 'Test 2',
                position: 1
            }, {
                name: 'Test 3',
                position: 2
            }]);
        };
    });

    it('can update model with limit', function() {
        return helper.app.models.Shoe.update({name: 'Test 1'}, {position: 99}, {limit: 1})
            .then(function(tests) {
                assert.equal(tests.length, 1);
                assert.equal(tests[0].name, 'Test 1');
                assert.equal(tests[0].position, 99);

                // Let's make sure we updated 1 model only
                return helper.app.models.Shoe.find({position: 99});
            })
            .then(function(tests) {
                assert.equal(tests.length, 1);
                assert.equal(tests[0].name, 'Test 1');
            });
    });

    it('can update multiple models', function() {
        return helper.app.models.Shoe.update({name: 'Test 1'}, {position: -1})
            .then(function(tests) {
                assert.equal(tests.length, 1);
            });
    });
});
