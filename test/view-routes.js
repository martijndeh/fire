/* global describe, before, it, after */
var fire = require('..');

var request = require('supertest');
var assert = require('assert');
var path = require('path');
var config = require('./../lib/helpers/config');

describe('view routes', function() {
    var app = null;
    var DEFAULT_HTML = '<!DOCTYPE html><html ng-app="app"><head><meta charset="utf-8"><meta name="fragment" content="!"><title></title><script src="/bower_components/angular/angular.min.js"></script><script src="/bower_components/angular-route/angular-route.min.js"></script><script src="/scripts/fire.js"></script></head><body ng-view></body></html>';

    after(function(done) {
        app.stop()
            .then(function() {
                done();
            });
    });

    before(function(done) {
        app = fire.app();

        // Let's create some controllers
        function TestController() {}
        fire.controller(TestController);

        app.template('test1', 'test1');
        app.template('test2', 'test2');
        app.template('test3', 'test3');

        TestController.prototype.view = function() {
            return this.template('test1');
        };

        TestController.prototype.viewUser = function() {
            return this.template('test2');
        };

        TestController.prototype.viewSpecial = ['/special/page', function() {
            return this.template('test3');
        }];

        app.run()
            .then(function() {
                done();
            })
            .done();
    });

    it('can find /', function(done) {
        request(app.express)
            .get('/')
            .expect(200, function(error, response) {
                assert.equal(response.text, DEFAULT_HTML);
                done(error);
            });
    });

    it('can find /user', function(done) {
        request(app.express)
            .get('/user')
            .expect(200, function(error, response) {
                assert.equal(response.text, DEFAULT_HTML);
                done(error);
            });
    });

    it('can find /special/page', function(done) {
        request(app.express)
            .get('/special/page')
            .expect(200, function(error, response) {
                assert.equal(response.text, DEFAULT_HTML);
                done(error);
            });
    });

    it('can find test1 template', function(done) {
        request(app.express)
            .get('/templates/test1')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test1');
                done(error);
            });
    });

    it('can find test2 template', function(done) {
        request(app.express)
            .get('/templates/test2')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test2');
                done(error);
            });
    });

    it('can find test3 template', function(done) {
        request(app.express)
            .get('/templates/test3')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test3');
                done(error);
            });
    });

    it('can load file-based template', function(done) {
        config.basePath = path.join(__dirname, 'fixtures');

        app.templates.load(path.join(config.basePath, 'templates', 'test4.html'))
            .then(function() {
                var template = app.templates.template('test4.html');

                assert.equal(template, 'test4\n');
                done();
            })
            .done();
    });
});
