var fire = require('..');
var Models = require('./../lib/models');
var assert = require('assert');

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
        models = null;

        done();
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
        function ModelOne() {
            this.name = [this.String];
            this.value = [this.Integer];
        }
        models.addModel(ModelOne);
        return models.ModelOne.setup()
            .then(function() {
                return models.ModelOne.findOrCreateOne({name: 'Test'}, {value: 123});
            })
            .then(function(model) {
                assert.equal(model.name, 'Test');
                assert.equal(model.value, 123);

                done();
            })
            .done();
    })
});
