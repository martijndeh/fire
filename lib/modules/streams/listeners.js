exports = module.exports = Listeners;

var Q = require('q');

/**
 * Internal module to LISTEN on notifications in Postgres.
 *
 * @constructor
 */
function Listeners(knex) {
    var modelNames = new Set(); //jshint ignore:line
    var _connection = null;

    var _getConnection = function() {
        if(_connection) {
            return Q.when(_connection);
        }
        else {
            return knex.client.acquireConnection()
                .then(function(connection) {
                    // TODO: Check if we're losing a connection. If so, reconnect.

                    _connection = connection;
                    return connection;
                });
        }
    };

    this.add = function(modelName, callback) {
        if(!modelNames.has(modelName)) {
            modelNames.add(modelName);

            return _getConnection()
                .then(function(connection) {
                    var onNotification = function(notification) {
                        try {
                            var payloadMap = JSON.parse(notification.payload);

                            console.log('Payload received in Listeners');

                            if(payloadMap.type == 'INSERT') {
                                // TODO: Parse model instances.
                                callback(payloadMap);
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
                    connection.connection.on('notification', onNotification);

                    var raw = knex.raw('LISTEN "' + modelName + '"');
                    raw.connection(connection);
                    return raw.exec();
                });
        }
    };

    this.close = function() {
        if(_connection) {
            return knex.client.releaseConnection(_connection);
        }
    };
}
