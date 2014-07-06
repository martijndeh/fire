/* global describe, beforeEach, afterEach, it, before */
'use strict';

var fire = require('..');
var assert = require('assert');
var request = require('supertest');

describe('controller routes', function() {
    var app = null;
    var createControllers = null;

    beforeEach(function(done) {
        app = fire.app('Routes Test', {});

        if(createControllers) {
            createControllers();
        }

        app.run()
            .then(function() {
                done();
            })
            .done();
    });

    afterEach(function(done) {
        app.stop()
            .then(function() {
                done();
            })
            .done();
    });

    describe('simple array-based route', function() {
        before(function() {
            createControllers = function() {
                function Controller() {}
                app.controller(Controller);

                Controller.prototype.getSimpleRoute = ['/test_routes.test', function() {
                    return 'Great.';
                }];
            };
        });

        it('responds on correct route', function(done) {
            var agent = request.agent(app.express);
            agent.get('/test_routes.test')
                .send()
                .expect(200, function(error, response) {
                    console.log(response.text);

                    assert.equal(response.text, '"Great."');
                    done(error);
                });
        });

        it('does not respond on invalid route', function(done) {
            var agent = request.agent(app.express);
            agent.get('/simple-routes')
                .send()
                .expect(404, function(error) {
                    done(error);
                });
        });
    });

    describe('array-based route with arguments', function() {
        before(function() {
            createControllers = function() {
                function Controller() {}
                app.controller(Controller);

                Controller.prototype.getTestRoute = ['/:test1/:test2', function($test1, $test2) {
                    return $test1 + ' ' + $test2;
                }];
            };
        });

        it('passes arguments to method', function(done) {
            var agent = request.agent(app.express);
            agent.get('/hello/world')
                .send()
                .expect(200, function(error, response) {
                    assert.equal(response.text, '"hello world"');
                    done(error);
                });
        });
    });
});
