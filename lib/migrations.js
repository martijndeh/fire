'use strict';

exports = module.exports = Migrations;

var util = require('util');
var Resources = require('./resources');
var Migration = require('./migration');
var utils = require('./utils');
var Schema = require('./schema');
var path = require('path');
var Q = require('q');
var utils = require('./utils');

function Migrations() {
    this._ = [];
    this.models = null;
}
util.inherits(Migrations, Resources);

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
            console.log('Migrations finished ' + toVersion);
            return true;
        })
        .fail(function(error) {
            throw error;
        });
};

Migrations.prototype.setup = function(fullPath, models) {
    this.models = models;

    Resources.prototype.setup.apply(this, arguments);

    // TODO: move to separate method & call properly during tests...
    this._.sort(function(a, b) {
        return (a.version - b.version);
    });

    // Let's inject our Schema model.
    this.models.addModel(Schema);

    var self = this;
    return this.models.Schema.exists()
        .then(function(exists) {
            if(!exists) {
                return self.models.Schema.setup();
            }
            else {
                return true;
            }
        });
};

Migrations.prototype.addMigration = function(MigrationClass, version) {
    // TODO: replace with actual inheritance?
    for(var method in Migration.prototype) {
        MigrationClass.prototype[method] = Migration.prototype[method];
    }

    this.models.datastore.setAllProperties(MigrationClass);

    var migration = new MigrationClass();
    Migration.call(migration, version, this.models);

    this._.push(migration);
}

Migrations.prototype.load = function(fullPath) {
    var MigrationClass = require(fullPath);

    var fileName = path.basename(fullPath);

    var version = utils.captureOne(fileName, /^([0-9]+)\-/);
    if(version) {
        this.addMigration(MigrationClass, version);
    }
    else {
        throw new Error('Invalid migration file name for file at path `' + fullPath + '`.');
    }
};
