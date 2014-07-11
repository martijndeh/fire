/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find limit', function() {
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
                var count = 100;
                var actions = [];

                while(count--) {
                    actions.push(app.models.Tester.create({name: 'Test', position: 100 - count}));
                }

                return Q.all(actions);
            };
        });

        it('can limit find', function(done) {
            helper.app.models.Tester.find({}, {limit:20})
                .then(function(testers) {
                    assert.equal(testers.length, 20);
                    done();
                })
                .done();
        });
    });

    describe('assocations', function() {
        before(function() {
            helper.setup = function(app) {
                function Article() {
                    this.name = [this.String];
                    this.comments = [this.HasMany(this.models.Comment), this.AutoFetch];
                }
                app.model(Article);

                function Comment() {
                    this.article = [this.BelongsTo(this.models.Article)];
                }
                app.model(Comment);
            };

            helper.createModels = function(app) {
                return Q.all([app.models.Article.create({name: 'Test'}), app.models.Article.create({name: 'Test'}), app.models.Article.create({name: 'OK'})])
                    .spread(function(a, b, c) {
                        var count = 20;
                        var actions = [];

                        while(count--) {
                            actions.push(app.models.Comment.create({article: a}));
                            actions.push(app.models.Comment.create({article: b}));
                            actions.push(app.models.Comment.create({article: c}));
                        }

                        return Q.all(actions);
                    });
            };
        });

        it('can limit find', function(done) {
            helper.app.models.Article.find({}, {limit:2})
                .then(function(articles) {
                    assert.equal(articles.length, 2);
                    assert.equal(articles[0].comments.length, 20);
                    assert.equal(articles[1].comments.length, 20);
                    done();
                })
                .done();
        });

        it('can limit find with where map', function(done) {
            helper.app.models.Article.find({name: 'OK'}, {limit:2})
                .then(function(articles) {
                    assert.equal(articles.length, 1);
                    assert.equal(articles[0].comments.length, 20);
                    done();
                })
                .done();
        });
    });
});
