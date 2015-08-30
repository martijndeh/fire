exports = module.exports = Request;

var express = require('express');

function Request(messageMap) {
    express.request.constructor.call(this);

    this.method = messageMap._method || 'GET';
    this.url = messageMap._path;
    this.body = messageMap._body || {};
    this.query = messageMap._query || {};
    this.params = {};
}

// This is Express-style
Request.prototype.__proto__ = express.request; //jshint ignore:line
