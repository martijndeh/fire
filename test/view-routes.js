/* global describe, before, it, after */
var fire = require('..');

var request = require('supertest');
var assert = require('assert');

describe('view routes', function() {
    var app = null;

    var DEFAULT_HTML = '<!DOCTYPE html><html ng-app="default" id="ng-app" xmlns:ng="http://angularjs.org"><head><meta charset="utf-8"><meta name="fragment" content="!"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title><script src="/bower_components/angular/angular.min.js"></script><script src="/bower_components/angular-route/angular-route.min.js"></script><script src="/scripts/fire.min.js"></script></head><body><div ng-view></div></body></html>';

    after(function() {
        return fire.stop();
    });

    before(function(done) {
        app = fire('routes', {});

        // Let's create some controllers
        function TestController() {}
        app.controller('/', TestController);

        app.template('view', DEFAULT_HTML);

        TestController.prototype.page = function() {
            return {
                template: 'view'
            };
        };

        app.template('test1', 'test1');
        app.template('test2', 'test2');
        app.template('test3', 'test3');
        app.template('test4', 'test4');

        function Test2Controller() {}
        app.controller('/test2', Test2Controller);

        Test2Controller.prototype.page = function() {
            return {
                template: 'test4'
            };
        };

        fire.start()
            .then(function() {
                done();
            })
            .done();
    });

    it('can find /', function(done) {
        request(app.HTTPServer.express)
            .get('/')
            .expect(200, function(error, response) {
                assert.equal(response.text, DEFAULT_HTML);
                done(error);
            });
    });

    it('can find test1 template', function(done) {
        request(app.HTTPServer.express)
            .get('/templates/test1.html')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test1');
                done(error);
            });
    });

    it('can find test2 template', function(done) {
        request(app.HTTPServer.express)
            .get('/templates/test2.html')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test2');
                done(error);
            });
    });

    it('can find test3 template', function(done) {
        request(app.HTTPServer.express)
            .get('/templates/test3.html')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test3');
                done(error);
            });
    });

    it('can find custom page', function(done) {
        request(app.HTTPServer.express)
            .get('/test2')
            .expect(200, function(error, response) {
                assert.equal(response.text, 'test4');
                done(error);
            });
    });
});
