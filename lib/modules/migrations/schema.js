'use strict';

exports = module.exports = Schema;

/**
 * Model created by the migrations.
 *
 * Keeps track of all executed migrations.
 *
 * When a rollback is executed on a migration, the related schema instance is destroyed. Currently rollbacks are not tracked in the schema instances.
 *
 * @access private
 *
 * @constructor
 */
function Schema() {
    this.version = [this.Integer];
    this.app = [this.String];
    this.checksum = [this.String];
    this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
}
