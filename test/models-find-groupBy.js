/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find groupBy', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Tester() {
                this.name = [this.String];
                this.position = [this.Integer];
            }
            app.model(Tester);
        };

        helper.createModels = function(app) {
            return Q.all([
                app.models.Tester.create({
                    name: 'Test 3',
                    position: 3
                }),

                app.models.Tester.create({
                    name: 'Test 1',
                    position: 3
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: 3
                }),

                app.models.Tester.create({
                    name: 'Test 3',
                    position: 2
                }),

                app.models.Tester.create({
                    name: 'Test 1',
                    position: 2
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: 2
                }),

                app.models.Tester.create({
                    name: 'Test 3',
                    position: 1
                }),

                app.models.Tester.create({
                    name: 'Test 1',
                    position: 1
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: 1
                })
            ]);
        };
    });

    it('can groupBy single property', function(done) {
        helper.app.models.Tester.find({}, {groupBy:'position', select:['position']})
            .then(function(testers) {
                assert.equal(testers.length, 3);
                done();
            })
            .done();
    });

    it('can groupBy two properties', function(done) {
        helper.app.models.Tester.find({}, {groupBy:['position', 'name'], select:['position', 'name']})
            .then(function(testers) {
                assert.equal(testers.length, 9);
                done();
            })
            .done();
    });

    it('can groupBy and orderBy', function(done) {
        helper.app.models.Tester.find({}, {orderBy:{position:1}, groupBy:['name', 'position'], select:['name']})
            .then(function(testers) {
                assert.equal(testers.length, 9);
                done();
            })
            .done();
    });
});
