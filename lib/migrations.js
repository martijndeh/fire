'use strict';

exports = module.exports = Migrations;

var util = require('util');
var Resources = require('./resources');
var Migration = require('./migration');
var utils = require('./utils');
var Schema = require('./schema');
var path = require('path');
var Q = require('q');

function Migrations() {
    this._ = [];
    this.models = null;
}
util.inherits(Migrations, Resources);

Migrations.prototype.setup = function(fullPath, models) {
    this.models = models;

    Resources.prototype.setup.apply(this, arguments);

    this._.sort(function(a, b) {
        return (a.version - b.version);
    });

    // Let's inject our Schema model.
    this.models.addModel(Schema);
    return Q.when(true);
};

Migrations.prototype.load = function(fullPath) {
    var MigrationClass = require(fullPath);

    // TODO: replace with actual inheritance?
    for(var method in Migration.prototype) {
        MigrationClass.prototype[method] = Migration.prototype[method];
    }

    this.models.datastore.setAllProperties(MigrationClass);

    var fileName = path.basename(fullPath);

    var version = utils.captureOne(fileName, /([0-9]+)\-/);
    if(version) {
        var migration = new MigrationClass();
        Migration.call(migration, fileName, version, this.models);

        this._.push(migration);
    }
    else {
        throw new Error('Invalid migration file name for file at path `' + fullPath + '`.');
    }
};
