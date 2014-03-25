var fire = require('..');
var Models = require('./../lib/models');
var assert = require('assert');
var Q = require('q');

describe('models', function() {
    var models;
    beforeEach(function(done) {
        models = new Models();
        models.setup(null)
            .then(function() {
                done();
            })
            .done();
    });

    afterEach(function(done) {
        // TODO: We should drop everything in beforeEach instead.
        Q.all([
            models.Schema && models.Schema.destroy(),
            models.ModelThree && models.ModelThree.destroy()
        ])
        .then(function() {
            models = null;
            done();
        })
        .fail(function(error) {
            console.log(error);
            console.log(error.stack);

            throw error;
        })
    });

    it('can reference model', function(done) {
        function ModelOne() {
            this.name = [this.Text];
        }

        models.addModel(ModelOne);

        function ModelTwo(models) {
            this.ref = [this.Reference(models.ModelOne)];
        }

        models.addModel(ModelTwo);

        done();
    });

    it('can create model when calling findOrCreateOne()', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.value = [this.Integer];
        }
        models.addModel(ModelThree);
        return models.ModelThree.setup()
            .then(function() {
                return models.ModelThree.findOrCreateOne({name: 'Test'}, {value: 123});
            })
            .then(function(model) {
                assert.equal(model.name, 'Test');
                assert.equal(model.value, 123);

                done();
            })
            .done();
    })
});
