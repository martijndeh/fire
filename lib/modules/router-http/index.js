exports = module.exports = RouterHTTP;

var utils = require('../../helpers/utils');
var Q = require('q');
var debug = require('debug')('fire:router-http');

function RouterHTTP(router, HTTPServer) {
    router.addTransport(this);

    var express = HTTPServer.express;

    this.addRoute = function(method, path, preparedConstructor) {
        express[method](path, function(request, response, next) {
            var privateMap = {};
            privateMap.request = request;
            privateMap.response = response;
            privateMap.next = next;

            Object.keys(request.params).forEach(function(paramName) {
                privateMap[paramName] = request.params[paramName];
            });

            Q.when(preparedConstructor(privateMap))
                .then(function(result) {
                    if(typeof result != 'undefined') {
                        if(result) {
                            response.json(result);
                        }
                        else {
                            response.status(404).send();
                        }
                    }
                    else {
                        // The undefined result signals that the handler is itself sending a value over the response.
                    }
                })
                .catch(function(error) {
                    if(error) {
                        debug(error);

                        response.status(error.status || 500).send({
                            error: error.message
                        });
                    }
                    else {
                        response.status(500).send({error: 'Internal Server Error'});
                    }
                })
                .done();
        });
    };

    this.addUse = function(path, preparedConstructor, constructor) {
        var dependencyNames = utils.getMethodArgumentNames(constructor);

        if(dependencyNames.indexOf('error') != -1) {
            express.use(path, function(error, request, response, next) {
                var privateMap = {};
                privateMap.request = request;
                privateMap.response = response;
                privateMap.next = next;
                privateMap.error = error;

                Object.keys(request.params).forEach(function(paramName) {
                    privateMap[paramName] = request.params[paramName];
                });

                preparedConstructor(privateMap);
            });
        }
        else {
            express.use(path, function(request, response, next) {
                var privateMap = {};
                privateMap.request = request;
                privateMap.response = response;
                privateMap.next = next;

                Object.keys(request.params).forEach(function(paramName) {
                    privateMap[paramName] = request.params[paramName];
                });

                Q.when(preparedConstructor(privateMap))
                    .then(function() {
                        next();
                    })
                    .catch(function(error) {
                        next(error);
                    });
            });
        }
    };
}
