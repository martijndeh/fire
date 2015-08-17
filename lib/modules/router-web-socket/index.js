exports = module.exports = RouterWebSocket;

var Q = require('q');
var utils = require('../../helpers/utils');

function RouterWebSocket(router, webSockets) {
    router.addTransport(this);

    var stack = [];
    var errorStack = [];

    webSockets.onContext(function(context) {
        var _parseMessage = function(messageMap) {
            var path = messageMap._path;
            var id = messageMap._id;

            if(path && id) {
                var request = {
                    session: {
                        save: function() {

                        }
                    },
                    body: messageMap._body || {},
                    query: messageMap._query || {},
                    params: {}
                };

                var response = {
                    json: function(json) {

                    },
                    status: function(statusCode) {

                    },
                    send: function() {

                    },
                    redirect: function() {

                    }
                };

                for(var i = 0, il = stack.length; i < il; i++) {
                    var route = stack[i];

                    //
                }
            }
        };

        var _parseData = function(data) {
            try {
                var messageMap = JSON.parse(data);

                _parseMessage(messageMap);
            }
            catch(e) {
                console.log(e);
                console.log(e.stack);
            }
        };
        context.webSocket.on('message', _parseData);
        context.webSocket.once('close', function() {
            context.webSocket.removeListener('close', _parseData);
        });
    });

    this.addRoute = function(path, preparedConstructor, constructor) {
        var dependencyNames = utils.getMethodArgumentNames(constructor);
        stack.push({
            path: path,
            dependencyNames: dependencyNames,
            constructor: preparedConstructor
        });
    };

    this.addUse = function(path, preparedConstructor, constructor) {
        var dependencyNames = utils.getMethodArgumentNames(constructor);

        if(dependencyNames.indexOf('error') >= 0) {
            errorStack.push({
                dependencyNames: dependencyNames,
                constructor: preparedConstructor
            });
        }
        else {
            stack.push({
                path: path,
                dependencyNames: dependencyNames,
                constructor: preparedConstructor
            });
        }
    };
}
