/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find select', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Tester() {
                this.name = [this.String];
                this.property1 = [this.Integer];
                this.property2 = [this.Integer];
                this.property3 = [this.Integer];
                this.property4 = [this.Integer];
            }
            app.model(Tester);
        };

        helper.createModels = function(app) {
            return app.models.Tester.create({
                name: 'Test',
                property1: 1,
                property2: 2,
                property3: 3,
                property4: 4
            });
        };
    });

    it('can limit selected properties', function(done) {
        helper.app.models.Tester.findOne({name: 'Test'}, {select:['property1']})
            .then(function(test) {
                assert.notEqual(typeof test.id, 'undefined');
                assert.notEqual(typeof test.property1, 'undefined');
                assert.equal(typeof test.property2, 'undefined');
                assert.equal(typeof test.property3, 'undefined');
                assert.equal(typeof test.property4, 'undefined');
                assert.equal(typeof test.name, 'undefined');

                done();
            })
            .done();
    });
});
