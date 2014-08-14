'use strict';

exports = module.exports = Schema;

/**
 * Model created by the migrations.
 *
 * Keeps track of all executed migrations.
 *
 * When a rollback is executed on a migration, the related schema instance is destroyed. Currently rollbacks are not tracked in the schema instances.
 */
function Schema() {
    this.version = [this.Integer];
    this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
}
