exports = module.exports = Response;

var stream = require('stream');
var util = require('util');
var express = require('express');

function MockStream() {
    stream.Writable.call(this);

    this._buffer = null;
}
util.inherits(MockStream, stream.Writable);

MockStream.prototype._write = function(chunk, encoding, done) {
    if(!this._buffer) {
        this._buffer = chunk;
    }
    else {
        this._buffer = Buffer.concat([this._buffer, chunk]);
    }

    done();
};

function Response(request) {
    express.response.constructor.call(this, request);

    this.connection = new MockStream();
    this.connection._httpMessage = this;

    this._headerSent = true;
}

Response.prototype.__proto__ = express.response; //jshint ignore:line
