'use strict';

var Q = require('q');
var fire = require('./../..');
var fs = require('fs');
var path = require('path');

exports = module.exports = new Helper();

function Helper() {
    this.setup = null;
    this.createModels = null;
    this.app = null;
    this.modules = null;
}

Helper.prototype.beforeEach = function(options) {
    var self = this;
    return function(done) {
        self.app = fire.app('test', options || {});

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
                if(self.createModels) {
                    return Q.when(self.createModels(self.app));
                }
                else {
                    return Q.when(true);
                }
            })
            .then(function() {
                var result = Q.when(true);

                self.modules = [];

                self.app.models.forEach(function(model) {
                    result = result.then(function() {
                        var writeStream = fs.createWriteStream(path.join(__dirname, '..', '..', 'temp', model.getName().toLowerCase() + '.js'));

                        return self.app.aPI.generateModelController(model, writeStream)
                            .then(function() {
                                self.modules.push(writeStream.path);

                                require(writeStream.path);
                            });
                    });
                });

                return result;
            })
            .then(function() {
                var defer = Q.defer();
                setImmediate(defer.makeNodeResolver());
                return defer.promise;
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
                return (self.modules && self.modules.forEach(function(modulePath) {
                    delete require.cache[modulePath];
                    fs.unlinkSync(modulePath);
                }));
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
