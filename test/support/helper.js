/* global it */
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
    this.modelNames = null;
}

Helper.prototype.test = function(name, callback) {
    var self = this;
    it(name, function(done) {
        var ret = self.app.injector.call(callback, {done: done});

        if(typeof ret != 'undefined') {
            Q.when(ret)
                .then(function() {
                    done();
                })
                .catch(function(error) {
                    done(error);
                })
                .done();
        }
        else {
            // `done` is assumed to be called by the test.
        }
    });
};

Helper.prototype.beforeEach = function(options) {
    var self = this;
    return function(done) {
        self.app = fire.app('test', options || {type: 'angular'});

        return (self.setup ? Q.when(self.setup(self.app)) : Q.when(true))
            .then(function() {
                return fire.start();
            })
            .then(function() {
                if(options && options.migrate) {
                    self.app.modules.forEach(function(module_) {
                        if(module_.migrate) {
                            module_.migrate(self.app.models);
                        }
                    });
                }
            })
            .then(function() {
                var result = Q.when(true);

                if(self.modelNames) {
                    self.modelNames.forEach(function(modelName) {
                        var model = self.app.models.internals[modelName];

                        result = result.then(function() {
                            return model.setup();
                        });
                    });
                    self.modelNames = null;
                }
                else {
                    self.app.models.forEach(function(model) {
                        result = result.then(function() {
                            return model.setup();
                        });
                    });
                }

                return result;
            })
            .then(function() {
                return self.app.tests.createTests();
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
                var defer = Q.defer();

                fs.mkdir(path.join(__dirname, '..', '..', 'temp'), function() {
                    defer.resolve();
                });

                return defer.promise;
            })
            .then(function() {
                var result = Q.when(true);

                self.modules = [];

                self.app.models.forEach(function(model) {
                    if(!model.disableAutomaticModelController) {
                        result = result.then(function() {
                            var writeStream = fs.createWriteStream(path.join(__dirname, '..', '..', 'temp', model.getName().toLowerCase() + '.js'));

                            return self.app.API.generateModelController(model, writeStream)
                                .then(function() {
                                    self.modules.push(writeStream.path);

                                    require(writeStream.path);
                                });
                        });
                    }
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
            .catch(function(error) {
                console.log(error);
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
                return model.isCreated().then(function(exists) {
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
                return fire.stop();
            })
            .then(function() {
                return (self.modules && self.modules.forEach(function(modulePath) {
                    delete require.cache[modulePath];
                    //fs.unlinkSync(modulePath);
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
