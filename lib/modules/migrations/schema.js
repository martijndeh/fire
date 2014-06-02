'use strict';

exports = module.exports = Schema;

var fire = require('./../../firestarter');

function Schema() {
    this.version = [this.Integer];
    this.createdAt = [this.DateTime, this.Default('CURRENT_DATE')];
}
fire.model(Schema);