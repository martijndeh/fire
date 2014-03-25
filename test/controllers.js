var Controllers = require('./../lib/controllers');
var Config = require('./../lib/config')
var utils = require('./../lib/utils');

var Q = require('q');

describe('controllers', function() {
    var controllers;
    beforeEach(function() {
        controllers = new Controllers();
        controllers.setup();
    });

    it('should call before', function(done) {
        function FirstOne() {

        }
        FirstOne.prototype.test = function() {
            //console.log('FirstOne#test');
        }

        function Controller3() {

        }

        Controller3.prototype.test3 = function() {
            //console.log('Controller3#test3')
        }

        Controller3.prototype.test = function() {
            //console.log('Controller3#test')
        }

        function Controller2() {

        }

        Controller2.prototype.hooks = [Controller3, FirstOne];

        Controller2.prototype.test = function() {
            //console.log('Controller2#test');
        }

        Controller2.prototype.test3 = function() {
            //console.log('Controller2#test3')
        }

        function Controller1() {

        }

        Controller1.prototype.test = function() {
            //console.log('Controller1#test');
        }

        Controller1.prototype.test2 = function() {
            //console.log('Controller1#test2');
        }

        Controller1.prototype.hooks = [Controller2];

        var controller = controllers.loadClass(Controller1, Config.basePath + '/controllers/controller.js', null);
        //console.log('test():')
        controller.test();
        //console.log('test2():')
        controller.test2();
        //console.log('test3():')
        controller.test3();

        done();
    });
})
