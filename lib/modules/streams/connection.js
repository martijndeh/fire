var Cookies = require('cookies');
var Stream = require('./stream');
var Q = require('q');
var debug = require('debug')('fire:streams');

exports = module.exports = Connection;

function Connection(webSocket) {
    this.webSocket = webSocket;
    this.streams = {};
    this.delegate = null;

    var self = this;
    function parseMessage(data) {
        try {
            var messageMap = JSON.parse(data);

            // TODO: Emit this as an event so other modules can listen to it.

            self.delegate.parseMessage(self, messageMap);
        }
        catch(e) {
            console.log(e);
            console.log(e.stack);
        }
    }

    webSocket.on('message', parseMessage);
    webSocket.once('close', function() {
        webSocket.removeListener('message', parseMessage);
        self.delegate.parseClose(self);
    });
}

Connection.prototype.setDelegate = function(delegate) {
    this.delegate = delegate;
};

Connection.prototype.send = function(messageMap) {
    this.webSocket.send(JSON.stringify(messageMap));
};

Connection.prototype.createStream = function(messageMap) {
    return new Stream(messageMap, this);
};

Connection.prototype.findAuthenticator = function(authenticatorModel) {
    debug('Connection#findAuthenticator ' + !!authenticatorModel);

    if(!authenticatorModel) {
		return Q.when(null);
	}

    var cookies = new Cookies(this.webSocket.upgradeReq, {}, process.env.SESSION_KEYS.split(','));
    var sid = cookies.get('sid');
    var session = {};
    if(sid) {
        try {
            session = JSON.parse(new Buffer(sid, 'base64').toString('utf8'));
        }
        catch(e) {
            //
        }
    }

    debug('Authenticator find ' + session.at);

	return authenticatorModel.findOne({accessToken:session.at});
};

Connection.prototype.registerStream = function(stream, knex) {
    var self = this;
    return knex.raw('LISTEN "' + stream.modelName + '"')
        .then(function() {
            var client = this;

            var onNotification = function(notification) {
                try {
                    var payloadMap = JSON.parse(notification.payload);

                    if(payloadMap.type == 'INSERT') {
                        self.delegate.parseRow(stream, payloadMap.row);
                    }
                    else {
                        // TODO: Implement other types as well.
                    }
                }
                catch(e) {
                    console.log(e);
                    console.log(e.stack);
                }
            };
            client.connection.connection.on('notification', onNotification);

            stream.close = function() {
                console.log(client.connection);
                client.connection.connection.removeListener('notification', onNotification);
            };
            self.streams[stream.id] = stream;
        });
};
