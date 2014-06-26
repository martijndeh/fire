'use strict';

exports = module.exports = Migrations;

var Migration = require('./migration');
var Schema = require('./schema');

var PropertyTypes = require('./../models/property-types');
var Model = require('./../models/model');

var utils = require('./../../helpers/utils');
var Resources = require('./../../helpers/resources');

var util = require('util');
var path = require('path');
var Q = require('q');

var debug = require('debug')('fire:migration');

function Migrations() {
    this._ = [];
    this.models = null;
    this.version = 0;
}
util.inherits(Migrations, Resources);

Migrations.prototype.resetAllModels = function() {
    var self = this;
    this.models.forEach(function(model) {
        if(model != self.models.Schema) {
            var modelName = model.getName();
            
            delete self.models[modelName];
            delete self.models.internals[modelName];
        }
    });
};

Migrations.prototype.destroyAllModels = function() {
    var result = Q.when(true);

    this.models.forEach(function(model) {
        result = result.then(function() {
            return model.exists()
                .then(function(exists) {
                    if(exists) {
                        return model.forceDestroy();
                    }
                    else {
                        return Q.when(true);
                    }
                });
        });
    });

    return result;
};

Migrations.prototype.currentVersion = function() {
    return this.models.Schema.findOne({}, {version:'desc'})
        .then(function(schema) {
            return schema && schema.version || 0;
        });
};

Migrations.prototype.softMigrate = function(toVersion) {
    var changes = this._.filter(function(migration) {
        return (migration.version <= toVersion);
    });

    return utils.invokeSeries(changes, 'soft');
};

Migrations.prototype.migrate = function(fromVersion, toVersion) {
    debug('Migrations#migrate ' + fromVersion + ' to ' + toVersion);

    var self = this;
    return this.softMigrate(fromVersion)
        .then(function() {
            var direction        = '';
            var changes          = [];

            if(fromVersion < toVersion) {
                direction = 'up';

                changes = self._.filter(function(migration) {
                    return (migration.version > fromVersion && migration.version <= toVersion);
                });
            }
            else if(fromVersion > toVersion) {
                //we're going down
                direction = 'down';

                changes = self._.reverse().filter(function(migration) {
                    return (migration.version <= fromVersion && migration.version > toVersion);
                });
            }
            else {
                throw new Error('The current database is already at version `' + toVersion + '`.');
            }

            if(Math.abs(fromVersion - toVersion) != changes.length) {
                throw new Error('Migrations from version `' + fromVersion + '` to version `' + toVersion + '`: found only `' + changes.length + '` migrations expected `' + Math.abs(fromVersion - toVersion) + '`. Did you create all migrations?');
            }

            return utils.invokeSeries(changes, 'go', direction);
        })
        .then(function() {
            return true;
        })
        .fail(function(error) {
            throw error;
        });
};

Migrations.prototype.loadMigrations = function(fullPath, models) {
    this.models = models;

    Resources.prototype.setup.apply(this, arguments);

    this._ = this._.sort(function(a, b) {
        return (a.version - b.version);
    });
};

Migrations.prototype.setup = function(fullPath, models) {
    var defer = Q.defer();

    this.loadMigrations(fullPath, models);

    // Let's inject our Schema model.
    util.inherits(Schema, Model);
    this.models.addModelConstructor(Schema);

    var self = this;
    setImmediate(function() {
        self.models.Schema.exists()
            .then(function(exists) {
                if(!exists) {
                    return self.models.Schema.setup();
                }
                else {
                    return true;
                }
            })
            .then(function() {
                defer.resolve();
            })
            .fail(function(error) {
                defer.reject(error);
            })
            .done();
    });

    return defer.promise;
};

Migrations.prototype.addMigration = function(MigrationClass, version) {
    // TODO: replace with actual inheritance?
    for(var method in Migration.prototype) {
        MigrationClass.prototype[method] = Migration.prototype[method];
    }

    Object.keys(PropertyTypes).forEach(function(propertyName) {
        // We check if it's set already, as e.g. migrations swizzle these methods
        if(!MigrationClass.prototype[propertyName]) {
            MigrationClass.prototype[propertyName] = PropertyTypes[propertyName];
        }
    });

    var migration = new MigrationClass();
    Migration.call(migration, version, this.models);

    if(!(typeof migration.up == 'function' && typeof migration.down == 'function')) {
        throw new Error('Migration with version `' + version + '` does not contain both an `up` and a `down` method.');
    }

    this._.push(migration);
};

Migrations.prototype.load = function(fullPath) {
    var MigrationClass = require(fullPath);

    var fileName = path.basename(fullPath);

    var version = parseInt(utils.captureOne(fileName, /^([0-9]+)\-/));
    if(version) {
        this.addMigration(MigrationClass, version);
    }
    else {
        throw new Error('Invalid migration file name for file at path `' + fullPath + '`.');
    }
};
