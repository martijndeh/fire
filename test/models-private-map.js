/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var request = require('supertest');

describe('models private map', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            function User() {
                this.email = [this.String, this.Authenticate];
            }
            app.model(User);

            User.prototype.accessControl = function() {
                return {
                    canCreate: function() {
                        return true;
                    }
                };
            };

            function Tester() {
                this.email = [this.String, this.Required];
            }
            app.model(Tester);

            Tester.prototype.accessControl = function() {
                return {
                    canCreate: function() {
                        return true;
                    }
                };
            };

            Tester.prototype.beforeCreate = function(authenticator) {
                assert.notEqual(authenticator, null);
                
                this.email = authenticator.email;
            };
        };

        helper.createModels = null;
    });

    var agent = null;

    it('can access private map', function(done) {
        agent = request.agent(helper.app.HTTPServer.express);
        agent
            .post('/api/users')
            .send({
                email: 'martijn@ff00ff.nl',
                password: 'test'
            })
            .expect(200, function(error) {
                assert.equal(error, null);

                agent
                    .post('/api/testers')
                    .send({})
                    .expect(200, function(error2, response) {
                        assert.equal(response.body.email, 'martijn@ff00ff.nl');
                        done(error2);
                    });
            });
    });
});
