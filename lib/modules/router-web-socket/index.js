exports = module.exports = RouterWebSocket;

var Request = require('./request');
var Response = require('./response');

function RouterWebSocket(router, webSockets) {
    router.addTransport(this);

    this.stages = ['build', 'release', 'run'];

    webSockets.onContext(function(context) {
        var _parseMessage = function(messageMap) {
            if(messageMap._path && messageMap._id) {
                var request = new Request(messageMap);
                var response = new Response(request);

                var onError = function() {
                    // TODO: Send an error

                    off();
                };
                var onFinish = function() {
                    var parts = response.connection._buffer.toString().split('\r\n\r\n');

                    // TODO: Parse the body based on the Content-Length instead.
                    // TODO: Check the statusCode

                    var result = null;

                    context.send({
                        _id: messageMap._id,
                        result: parts[1]
                    });

                    off();
                };

                var off = function() {
                    response.removeListener('finish', onFinish);
                    response.removeListener('error', onError);
                };

                response.on('finish', onFinish);

                response.on('error', onError);

                return router.handle(request, response, null);
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
}
