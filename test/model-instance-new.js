/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('model instance new', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function Pie() {
                this.type = [this.String];
            }
            app.model(Pie);
        };

        helper.createModels = function() {
            //
        };
    });

    it('can create new model instance', function() {
        var pie = helper.app.models.Pie.new();
        assert.notEqual(pie, null);
        assert.equal(pie.id, null);
    });

    it('can save new model instance', function(done) {
        var pie = helper.app.models.Pie.new();
        pie.type = 'Apple';
        pie.save()
            .then(function() {
                return helper.app.models.Pie.findOne();
            })
            .then(function(persistedPie) {
                assert.equal(pie.id, persistedPie.id);
                assert.equal(pie.type, persistedPie.type);
                assert.equal(pie.type, 'Apple');
                
                done();
            })
            .catch(function(error) {
                done(error);
            });
    });
});
