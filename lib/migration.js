'use strict';

exports = module.exports = Migration;

var Q = require('q');

function Migration(fileName, version, models) {
    this.fileName = fileName;
    this.version = version;
    this.models = models;
    this._persist = false;
}

Migration.prototype.go = function(direction) {
    // Now let's call the actual migration in the right direction
    var self = this;
    return Q.when(this[direction].call(this))
        .then(function() {
            if(direction == 'up') {
                // We migrated upwards, so we insert a schema with our version
                return self.models.Schema.createOne({version: self.version});
            }
            else {
                // We migrated downwards... so let's remove this schema
                return self.models.Schema.remove({version: self.version});
            }
        })
        .fail(function(error) {
            throw error;
        });
};

Migration.prototype.soft = function() {
    this._persist = false;

    var self = this;
    return Q.when(this.up())
        .then(function() {
            self._persist = false;
            return true;
        });
};

Migration.prototype.destroyModel = function(modelName) {
    return this.models.destroyModel(modelName, this._persist);
};

Migration.prototype.createModel = function(modelName, properties) {
    return this.models.createModel(modelName, properties, this._persist);
};
