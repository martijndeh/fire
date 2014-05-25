'use strict';

exports = module.exports = Schema;

var fire = require('..');

function Schema() {
    this.version = [this.Integer];
    this.createdAt = [this.DateTime, this.Default('CURRENT_DATE')];
}
fire.model(Schema);