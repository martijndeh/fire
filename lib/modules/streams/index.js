'use strict';

exports = module.exports = Streams;

var WebSocketServer = require('ws').Server;
var debug = require('debug')('fire:streams');
var Q = require('q');
var MessageQueue = require('./../message-queue');
var Connection = require('./connection');

var http = require('http');

function merge(dest, source) {
	Object.keys(source).forEach(function(key) {
		dest[key] = source[key];
	});
	return dest;
}

/**
 * The WebSocket module.
 *
 * Listens for web socket connections.
 * @constructor
 */
function Streams(app) {
	this.app = app;
	this.messageQueue = MessageQueue.factory();
	this.connections = [];
}

Streams.prototype.stages = ['run'];

/**
 * Starts the web socket server if this is the web process.
 *
 * @param  {Dictionary} argv The process starting arguments.
 */
Streams.prototype.start = function(argv, HTTPServer) {
	if(process.env.NODE_ENV != 'test' && !argv.web && Object.keys(argv).length > 1 || !HTTPServer.express) {
		debug('Not starting web socket server');
		return false;
	}

	debug('Creating stream server');

	this.server = new WebSocketServer({server: HTTPServer.server});

	var self = this;
	this.server.on('connection', function(webSocket) {
		debug('Creating new connection');

		var connection = new Connection(webSocket);
		connection.setDelegate(self);
	});
};

Streams.prototype.stop = function() {
	if(this.server) {
		this.server.close();
	}
};

Streams.prototype.canSubscribe = function(stream) {
	debug('Streams#canSubscribe');

	var self = this;
	var authenticatorModel = self.app.models.getAuthenticator();

	debug('Found authenticator model...');
	debug('Stream:');
	debug(stream);
	debug('Connection: ');
	debug(stream.connection);

	return stream.connection.findAuthenticator(authenticatorModel)
		.then(function(authenticator) {
			var model = self.app.models.findModel(stream.modelName);
			if(!model) {
				debug('Bad Request');

				throw 400;
			}
			else {
				debug('All good, checking access control!');

				var accessControl = model.getAccessControl();
				return Q.when(accessControl.canRead({authenticator: authenticator, whereMap: stream.whereMap}))
					.then(function(canRead) {
						if(canRead) {
							debug('Can read.');

							if(typeof canRead == 'object') {
								stream.whereMap = merge(stream.whereMap, canRead);
							}

							return canRead;
						}
						else {
							if(authenticator) {
								debug('Forbidden');
								throw 403;
							}
							else {
								debug('Unauthorized');
								throw 401;
							}
						}
					});
			}
		});
};

Streams.prototype.parseSubscribe = function(connection, messageMap) {
	debug('Streams#parseSubscribe');
	debug(messageMap);

	var stream = connection.createStream(messageMap);
	var self = this;
	return this.canSubscribe(stream)
		.then(function() {
			debug('Register stream.');

			return connection.registerStream(stream, self.messageQueue);
		})
		.then(function() {
			debug(stream.modelName + '#find.');

			var model = self.app.models.findModel(stream.modelName);
			return model.find(stream.whereMap, stream.optionsMap);
		})
		.then(function(modelInstances) {
			debug('Found ' + modelInstances.length + ' model instances.');

			return self.sendModelInstances(stream, modelInstances);
		})
		.catch(function(errorStatus) {
			debug('Error `' + errorStatus + '` in subscribe');

			connection.send({
				msg: 'nosub',
				error: {
					status: errorStatus,
					message: http.STATUS_CODES[errorStatus]
				}
			});
		});
};

Streams.prototype.parseUnsubscribe = function(connection, messageMap) {
	//
};

Streams.prototype.parseClose = function(connection) {
	Object.keys(connection.streams).forEach(function(streamId) {
		var stream = connection.streams[streamId];
		stream.close();
	});
	connection.streams = {};
	connection.setDelegate(null);
};

Streams.prototype.sendModelInstances = function(stream, modelInstances) {
	debug('Send model instances.');

	stream.connection.send({
		msg: 'added',
		id: stream.id,
		result: modelInstances
	});
};

Streams.prototype.match = function(stream, modelMap) {
	return Object.keys(stream.whereMap).length === 0 || !!Object.keys(stream.whereMap).filter(function(key) {
		var whereValue = stream.whereMap[key];

		if(whereValue === null) {
			return (modelMap[key] === null);
		}
		else if(typeof whereValue == 'object') {
			return !!Object.keys(whereValue).filter(function(comparator) {
				var value = whereValue[comparator];

				if(comparator == '$gt') {
					return modelMap[key] > value;
				}
				else if(comparator == '$lt') {
					return modelMap[key] < value;
				}
				else if(comparator == '$gte') {
					return modelMap[key] >= value;
				}
				else if(comparator == '$lte') {
					return modelMap[key] <= value;
				}
				else if(comparator == '$in') {
					return value.indexOf(modelMap[key]) >= 0;
				}
				else if(comparator == '$not') {
					return modelMap[key] != value;
				}
				else {
					debug('Unknown comparator `' + comparator + '`.');

					return false;
				}
			}).length;
		}
		else {
			return (modelMap[key] === whereValue);
		}
	}).length;
};

Streams.prototype.parseModelInstance = function(stream, modelMap) {
	if(this.match(stream, modelMap)) {
		this.sendModelInstances(stream, [
			modelMap
		]);
	}
	else {
		debug('Model does not match stream\'s where map.');
		console.log(modelMap);
		console.log(stream.whereMap);
	}
};

Streams.prototype.parseMessage = function(connection, messageMap) {
	debug('Streams#parseMessage `' + messageMap.msg + '`');

	if(messageMap.msg == 'ping') {
		connection.send({
			msg: 'pong',
			id: messageMap.id
		});
	}
	else if(messageMap.msg == 'pong') {
		// OK
	}
	else if(messageMap.msg == 'sub') {
		this.parseSubscribe(connection, messageMap);
	}
	else if(messageMap.msg == 'unsub') {
		this.parseUnsubscribe(connection, messageMap);
	}
	else if(messageMap.msg == 'method') {
		connection.send({
			msg: 'result',
			id: messageMap.id,
			error: {
				statusCode: 501,
				message: http.STATUS_CODES[501]
			}
		});
	}
	else {
		//
	}
};
