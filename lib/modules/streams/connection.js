var Stream = require('./stream');

exports = module.exports = Connection;

function Connection(context) {
    var _streams = {};
    var _delegate = null;

    var self = this;
    var parseMessage = function(data) {
        try {
            var messageMap = JSON.parse(data);
            _delegate.parseMessage(self, messageMap);
        }
        catch(e) {
            console.log(e);
            console.log(e.stack);
        }
    };

    context.webSocket.on('message', parseMessage);
    context.webSocket.once('close', function() {
        context.webSocket.removeListener('message', parseMessage);

        Object.keys(_streams).forEach(function(streamId) {
			var stream = _streams[streamId];
			stream.close();
		});
		_streams = {};
		_delegate = null;
    });

    this.findAuthenticator = function() {
        return context.findAuthenticator();
    };

    this.setDelegate = function(delegate) {
        _delegate = delegate;
    };

    this.send = function(messageMap) {
        context.send(messageMap);
    };

    this.createStream = function(messageMap) {
        return new Stream(messageMap, this);
    };

    this.registerStream = function(stream) {
        _streams[stream.id] = stream;
    };
}
