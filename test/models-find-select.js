/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find select', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    describe('basic usage', function() {
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

    describe('including associations', function() {
        before(function() {
            helper.setup = function(app) {
                function User() {
                    this.name = [this.String];
                    this.age = [this.Integer];
                    this.projects = [this.HasMany(this.models.Project), this.AutoFetch];
                }
                app.model(User);

                function Project() {
                    this.name = [this.String];
                    this.user = [this.BelongsTo(this.models.User)];
                    this.value = [this.Integer];
                }
                app.model(Project);
            };

            helper.createModels = function(app) {
                return app.models.User.create({
                        name: 'Martijn',
                        age: 50
                    })
                    .then(function(user) {
                        return app.models.Project.create([
                            {
                                name: 'Project 1',
                                user: user,
                                value: 123
                            },
                            {
                                name: 'Project 2',
                                user: user,
                                value: 124
                            }
                        ]);
                    });
            };
        });

        it('can limit selected properties', function(done) {
            helper.app.models.User.findOne({}, {select:['name', 'projects.name']})
                .then(function(user) {
                    assert.notEqual(user, null);
                    assert.notEqual(typeof user.id, 'undefined');
                    assert.notEqual(typeof user.name, 'undefined');
                    assert.notEqual(typeof user.projects, 'undefined');
                    assert.equal(typeof user.age, 'undefined');

                    assert.equal(user.projects.length, 2);

                    assert.notEqual(typeof user.projects[0].name, 'undefined');
                    assert.equal(typeof user.projects[0].user, 'undefined');
                    assert.equal(typeof user.projects[0].value, 'undefined');

                    assert.notEqual(typeof user.projects[1].name, 'undefined');
                    assert.equal(typeof user.projects[1].user, 'undefined');
                    assert.equal(typeof user.projects[1].value, 'undefined');

                    done();
                })
                .done();
        });

        it('can select all properties', function(done) {
            helper.app.models.User.findOne({}, {select:['name', 'projects.*']})
                .then(function(user) {
                    assert.notEqual(user, null);
                    assert.notEqual(typeof user.id, 'undefined');
                    assert.notEqual(typeof user.name, 'undefined');
                    assert.notEqual(typeof user.projects, 'undefined');
                    assert.equal(typeof user.age, 'undefined');

                    assert.equal(user.projects.length, 2);

                    assert.notEqual(typeof user.projects[0].name, 'undefined');
                    assert.notEqual(typeof user.projects[0].user, 'undefined');
                    assert.notEqual(typeof user.projects[0].value, 'undefined');

                    assert.notEqual(typeof user.projects[1].name, 'undefined');
                    assert.notEqual(typeof user.projects[1].user, 'undefined');
                    assert.notEqual(typeof user.projects[1].value, 'undefined');

                    done();
                })
                .done();
        });
    });
});
