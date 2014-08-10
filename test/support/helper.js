'use strict';

var Q = require('q');
var fire = require('./../..');

exports = module.exports = new Helper();

function Helper() {
    this.setup = null;
    this.createModels = null;
}

Helper.prototype.beforeEach = function() {
    var self = this;
    return function(done) {
        self.app = fire.app('test');

        return Q.when(self.setup(self.app))
            .then(function() {
                return self.app.run();
            })
            .then(function() {
                var result = Q.when(true);

                self.app.models.forEach(function(model) {
                    result = result.then(function() {
                        return model.setup();
                    });
                });

                return result;
            })
            .then(function() {
                return Q.when(self.createModels(self.app));
            })
            .then(function() {
                done();
            })
            .done();
    };
};

Helper.prototype.afterEach = function() {
    var self = this;
    return function(done) {
        var result = Q.when(true);

        self.app.models.forEach(function(model) {
            result = result.then(function() {
                return model.exists().then(function(exists) {
                    if(exists) {
                        return model.forceDestroy();
                    }
                    else {
                        return Q.when(true);
                    }
                });
            });
        });

        result
            .then(function() {
                return self.app.stop();
            })
            .then(function() {
                done();
            })
            .done();
    };
};

Helper.prototype.jsonify = function(map) {
    var json = {};
    Object.keys(map).forEach(function(key) {
        json[key] = JSON.stringify(map[key]);
    });
    return json;
};
