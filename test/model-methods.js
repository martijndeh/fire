var fire = require('..');
var Models = require('./../lib/models');

describe('models', function() {
    var models;
    before(function() {
        models = new Models();
        models.setup(null);
    });

    it('can reference model', function(done) {
        function ModelOne() {
            this.name = [this.Text];
        }

        models.addModel(ModelOne);

        function ModelTwo(models) {
            this.ref = [this.Reference(models.ModelOne)]
        }

        models.addModel(ModelTwo);

        done();
    });
})
