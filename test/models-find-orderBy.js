/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find orderBy', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    describe('simple', function() {
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
                        position: 1
                    }),

                    app.models.Tester.create({
                        name: 'Test 2',
                        position: 2
                    })
                ]);
            };
        });

        it('can orderBy sort map', function(done) {
            helper.app.models.Tester.find({}, {orderBy:{position:1}})
                .then(function(testers) {
                    assert.equal(testers.length, 3);
                    for(var i = 0, il = testers.length; i < il; i++) {
                        var position = (i + 1);
                        assert.equal(testers[i].name, 'Test ' + position);
                        assert.equal(testers[i].position, position);
                    }
                    done();
                })
                .done();
        });

        it('can orderBy sort map reverse', function(done) {
            helper.app.models.Tester.find({}, {orderBy:{position:-1}})
                .then(function(testers) {
                    assert.equal(testers.length, 3);

                    for(var i = 0, il = testers.length; i < il; i++) {
                        var position = 3 - i;

                        assert.equal(testers[i].name, 'Test ' + position);
                        assert.equal(testers[i].position, position);
                    }
                    done();
                })
                .done();
        });

        it('can orderBy sort map ASC', function(done) {
            helper.app.models.Tester.find({}, {orderBy:{position:'ASC'}})
                .then(function(testers) {
                    assert.equal(testers.length, 3);
                    for(var i = 0, il = testers.length; i < il; i++) {
                        var position = (i + 1);
                        assert.equal(testers[i].name, 'Test ' + position);
                        assert.equal(testers[i].position, position);
                    }
                    done();
                })
                .done();
        });

        it('can orderBy sort map DESC', function(done) {
            helper.app.models.Tester.find({}, {orderBy:{position:'DESC'}})
                .then(function(testers) {
                    assert.equal(testers.length, 3);

                    for(var i = 0, il = testers.length; i < il; i++) {
                        var position = 3 - i;

                        assert.equal(testers[i].name, 'Test ' + position);
                        assert.equal(testers[i].position, position);
                    }
                    done();
                })
                .done();
        });
    });

    describe('associations one-to-many', function() {
        before(function() {
            helper.setup = function(app) {
                app.models.Comment = 'Comment';
                app.models.Article = 'Article';

                function TestArticle() {
                    this.name = [this.String];
                    this.comments = [this.HasMany(this.models.TestComment), this.AutoFetch, this.Private];
                    this.numberOfComments = [this.Count('comments')];
                }
                app.model(TestArticle);

                function TestComment() {
                    this.name = [this.String];
                    this.article = [this.BelongsTo(this.models.TestArticle)];
                }
                app.model(TestComment);
            };

            helper.createModels = function(app) {
                return Q.all([
                    app.models.TestArticle.create({
                        name: 'Test 3'
                    }),

                    app.models.TestArticle.create({
                        name: 'Test 1'
                    }),

                    app.models.TestArticle.create({
                        name: 'Test 2'
                    })
                ]).spread(function(a, b, c) {
                    var actions = [];

                    var numberOfComments = 20;
                    while(numberOfComments--) {
                        actions.push(app.models.TestComment.create({name: 'Comment ' + numberOfComments, article: a}));
                    }

                    numberOfComments = 10;
                    while(numberOfComments--) {
                        actions.push(app.models.TestComment.create({name: 'Comment ' + numberOfComments, article: b}));
                    }

                    numberOfComments = 8;
                    while(numberOfComments--) {
                        actions.push(app.models.TestComment.create({name: 'Comment ' + numberOfComments, article: c}));
                    }

                    return Q.all(actions);
                });
            };
        });

        it('can orderBy read-only property', function(done) {
            helper.app.models.TestArticle.find({}, {orderBy:{numberOfComments:'ASC'}})
                .then(function(articles) {
                    assert.equal(articles.length, 3);

                    assert.equal(articles[2].name, 'Test 3');
                    assert.equal(articles[2].comments.length, 20);

                    assert.equal(articles[1].name, 'Test 1');
                    assert.equal(articles[1].comments.length, 10);

                    assert.equal(articles[0].name, 'Test 2');
                    assert.equal(articles[0].comments.length, 8);

                    done();
                })
                .done();
        });
    });
});
