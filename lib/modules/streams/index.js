'use strict';

exports = module.exports = Streams;

var WebSocketServer = require('ws').Server;
var debug = require('debug')('fire:streams');
var Q = require('q');
var Connection = require('./connection');
var ModelInstance = require('./../models/model-instance');
var http = require('http');

function merge(dest, source) {
	Object.keys(source).forEach(function(key) {
		dest[key] = source[key];
	});
	return dest;
}

/**
 * The Streams module.
 *
 * Creates streams over web sockets connections and listens for changes in the datastore through PostgreSQL's LISTEN and NOTIFY mechanisms.
 *
 * Important: this module creates triggers to notify any listeners for changes whenever a row gets inserted, updated or deleted. It uses the PostgreSQL's NOTIFY system. By default, this system has a payload limit of 8000 bytes. The payload is the changed row plus a few bytes of additional data combined and transformed to json. The triggers created by Node on Fire check if the payload is longer than 8000 bytes, and if so, do not notify any listeners of the change.
 *
 * If you want to change this default behavior, or if you have changed the maximum size of the payload, you can change the trigger in your migrations manually. Please note: if you do NOTIFY with a payload larger than the maximum size it will raise an exception and stop the original SELECT, UPDATE or DELETE from happening.
 *
 * @constructor
 */
function Streams(app) {
	this.app = app;
	this.connections = [];
}

Streams.prototype.stages = ['build', 'run'];

Streams.prototype.migrate = function(models) {
	debug('Streams#migrate');

	models.forEach(function(model) {
		// In some tests, some models are not initialized yet, thus checking if model.getName is truthy avoids errors.
		if(model && !model.isPrivate && model.getName) {
			var channelName = model.getName();
			var tableName = model.getTable().name;

			models.sql([
				'CREATE OR REPLACE FUNCTION publish' + channelName + '() RETURNS trigger AS $$',
				'DECLARE',
				'    payload TEXT;',
				'BEGIN',
				'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
				'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',

				'        IF octet_length(payload) < 8000 THEN',
				'		      PERFORM pg_notify(\'' + channelName + '\', payload);',
				'        END IF;',

				'        RETURN NEW;',
				'	ELSE',
				'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',

				'        IF octet_length(payload) < 8000 THEN',
				'    		PERFORM pg_notify(\'' + channelName + '\', payload);',
				'        END IF;',

				'		RETURN OLD;',
				'	END IF;',
				'END;',
				'$$ LANGUAGE plpgsql;',
				'',
				'CREATE TRIGGER ' + tableName + '_notify_update AFTER UPDATE ON ' + tableName + ' FOR EACH ROW EXECUTE PROCEDURE publish' + channelName + '();',
				'CREATE TRIGGER ' + tableName + '_notify_insert AFTER INSERT ON ' + tableName + ' FOR EACH ROW EXECUTE PROCEDURE publish' + channelName + '();',
				'CREATE TRIGGER ' + tableName + '_notify_delete AFTER DELETE ON ' + tableName + ' FOR EACH ROW EXECUTE PROCEDURE publish' + channelName + '();'
			].join('\n'), [
				'DROP TRIGGER ' + tableName + '_notify_update ON ' + tableName + ';',
				'DROP TRIGGER ' + tableName + '_notify_insert ON ' + tableName + ';',
				'DROP TRIGGER ' + tableName + '_notify_delete ON ' + tableName + ';',
			].join('\n'));
		}
	});
};

/**
 * Starts the web socket server if this is the web process.
 *
 * @param  {Dictionary} argv The process starting arguments.
 */
Streams.prototype.start = function(argv, HTTPServer, knex) {
	if(process.env.NODE_ENV != 'test' && !argv.web && Object.keys(argv).length > 1 || !HTTPServer.express) {
		debug('Not starting web socket server');
		return false;
	}

	debug('Creating stream server');

	this.knex = knex;
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

	var stream = connection.createStream(messageMap);
	var self = this;
	return this.canSubscribe(stream)
		.then(function() {
			debug('Register stream.');

			return connection.registerStream(stream, self.knex);
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

Streams.prototype.parseUnsubscribe = function(connection, messageMap) { //jshint ignore:line
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

Streams.prototype.parseModelInstance = function(stream, modelInstance) {
	if(this.match(stream, modelInstance)) {
		var model = this.app.models[stream.modelName];
		if(modelInstance._isPartial && model._containsAutoFetchProperty()) {
			// OK, so this creates potential scalability issues. But we cannot send incomplete model instances to the client.
			//
			// When model instances get created, they are considered partial because we're not automatically fetching all auto fetched associations. They are created from the result of the INSERT query.
			//
			// Because we're about to send the model instance to the client, and we found (a couple of) auto fetched associations, we re-fetch the model instance from the datastore.
			var self = this;
			return model.findOne({id: modelInstance._id})
				.then(function(updatedModelInstance) {
					return self.sendModelInstances(stream, [
						updatedModelInstance
					]);
				});
		}
		else {
			return this.sendModelInstances(stream, [
				modelInstance
			]);
		}
	}
	else {
		debug('Model does not match stream\'s where map.');
	}
};

Streams.prototype.parseRow = function(stream, rowMap) {
	debug('Streams#parseRow');

	var modelInstance = new ModelInstance(this.app.models[stream.modelName], rowMap, null, rowMap.id, null, true, true, {});

	return this.parseModelInstance(stream, modelInstance);
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
