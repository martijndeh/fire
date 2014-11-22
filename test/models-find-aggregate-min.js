/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find aggregate', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Tester() {
                this.name = [this.String];
                this.position = [this.Integer];
                this.minPosition = [this.Aggregate('min', 'position')];
            }
            app.model(Tester);
        };

        helper.createModels = function(app) {
            return Q.all([
                app.models.Tester.create({
                    name: 'Test 1',
                    position: -123
                }),

                app.models.Tester.create({
                    name: 'Test 1',
                    position: 3
                }),

                app.models.Tester.create({
                    name: 'Test 1',
                    position: 3
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: -223
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: 2
                }),

                app.models.Tester.create({
                    name: 'Test 2',
                    position: 2
                }),

                app.models.Tester.create({
                    name: 'Test 3',
                    position: -333
                }),

                app.models.Tester.create({
                    name: 'Test 3',
                    position: 1
                }),

                app.models.Tester.create({
                    name: 'Test 3',
                    position: 1
                })
            ]);
        };
    });

    it('can select min aggregate property', function(done) {
        helper.app.models.Tester.find({}, {groupBy:'name', orderBy:{'name': 1}, select:['name', 'minPosition']})
            .then(function(testers) {
                assert.equal(testers.length, 3);
                assert.equal(testers[0].name, 'Test 1');
                assert.equal(testers[0].minPosition, -123);

                assert.equal(testers[1].name, 'Test 2');
                assert.equal(testers[1].minPosition, -223);

                assert.equal(testers[2].name, 'Test 3');
                assert.equal(testers[2].minPosition, -333);

                done();
            })
            .done();
    });

    it('can select min aggregate property and order by', function(done) {
        helper.app.models.Tester.find({}, {groupBy:'name', orderBy:{'minPosition': 1}, select:['name', 'minPosition']})
            .then(function(testers) {
                assert.equal(testers.length, 3);
                assert.equal(testers[0].name, 'Test 3');
                assert.equal(testers[1].name, 'Test 2');
                assert.equal(testers[2].name, 'Test 1');

                done();
            })
            .done();
    });

    // TODO: Implement something like HAVING or to use in WHERE
});
