/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

/*
describe('model validate', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Tester() {
                this.name = [this.String];
                this.position = [this.Integer];

            }
            app.model(Tester);

            Tester.prototype.validate = function() {
                return {
                    name: function() {
                        return (this.name && this.name.length > 3);
                    },

                    position: function() {
                        return (this.position >= 0 && this.position <= 100);
                    },

                    width: function() {
                        return Q.when(true);
                    }
                };
            };
        };

        helper.createModels = function() {
            //
        };
    });

    it('can ')
});
*/
