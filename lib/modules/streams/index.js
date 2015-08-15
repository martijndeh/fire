'use strict';

exports = module.exports = Streams;

var debug = require('debug')('fire:streams');
var Q = require('q');
var Connection = require('./connection');
var Listeners = require('./listeners');
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
function Streams(HTTPServer, webSockets, models) {
	var _listeners = null;
	var _streams = {};

	this.stages = ['build', 'run'];

	this.migrate = function() {
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
	this.start = function(argv, knex) {
		if(process.env.NODE_ENV != 'test' && !argv.web && Object.keys(argv).length > 1 || !HTTPServer.express) {
			debug('Not starting web socket server');
			return false;
		}

		debug('Creating streams');

		_listeners = new Listeners(knex);

		var self = this;
		webSockets.onContext(function(context) {
			var connection = new Connection(context);
			connection.setDelegate(self);
		});
	};

	this.stop = function() {
		if(_listeners) {
			return _listeners.close();
		}
	};

	var _canSubscribe = function(stream) {
		debug('Streams#canSubscribe');

		return stream.connection.findAuthenticator()
			.then(function(authenticator) {
				var model = models.findModel(stream.modelName);
				if(!model) {
					debug('Bad Request');

					throw 400;
				}
				else {
					var accessControl = model.getAccessControl();
					return Q.when(accessControl.canRead({authenticator: authenticator, whereMap: stream.whereMap}))
						.then(function(canRead) {
							if(canRead) {
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

	var _registerStream = function(stream, connection) {
		var isListening = false;

		if(typeof _streams[stream.modelName] == 'undefined') {
			_streams[stream.modelName] = [];
		}
		else {
			isListening = true;
		}

		_streams[stream.modelName].push(stream);

		stream.close = function() {
			var streams = _streams[stream.modelName];
			var index = streams.indexOf(stream);
			if(index >= 0) {
				streams.splice(index, 1);
			}

			if(streams.length === 0) {
				// TODO: Remove the LISTEN
			}
		};
		connection.registerStream(stream);

		if(!isListening) {
			return _listeners.add(stream.modelName, function(payloadMap) {
				if(payloadMap.type == 'INSERT') {
					console.log('Payload map is:');
					console.log(payloadMap);

					return _parseRow(stream.modelName, payloadMap.row);
				}
				else {
					// TODO: Implement other types as well.
				}
			});
		}
	};

	var _parseSubscribe = function(connection, messageMap) {
		debug('Streams#parseSubscribe');

		var stream = connection.createStream(messageMap);

		console.log('Created stream ' + stream.id);

		return _canSubscribe(stream)
			.then(function() {
				debug('Register stream ' + stream.id);

				return _registerStream(stream, connection);
			})
			.then(function() {
				debug(stream.modelName + '#find');

				var model = models.findModel(stream.modelName);
				return model.find(stream.whereMap, stream.optionsMap);
			})
			.then(function(modelInstances) {
				debug('Found ' + modelInstances.length + ' model instances.');

				return _sendModelInstances(stream, modelInstances);
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

	var _parseUnsubscribe = function(connection, messageMap) { //jshint ignore:line
		//
	};

	var _sendModelInstances = function(stream, modelInstances) {
		debug('Send ' + modelInstances.length + ' model instances.');

		stream.connection.send({
			msg: 'added',
			id: stream.id,
			result: modelInstances
		});
	};

	var _match = function(stream, modelInstance) {
		return Object.keys(stream.whereMap).length === 0 || !!Object.keys(stream.whereMap).filter(function(key) {
			var whereValue = stream.whereMap[key];
			var compare = modelInstance._getValue(key);

			if(whereValue === null) {
				return (compare === null);
			}
			else if(typeof whereValue == 'object') {
				return !!Object.keys(whereValue).filter(function(comparator) {
					var value = whereValue[comparator];

					if(comparator == '$gt') {
						return compare > value;
					}
					else if(comparator == '$lt') {
						return compare < value;
					}
					else if(comparator == '$gte') {
						return compare >= value;
					}
					else if(comparator == '$lte') {
						return compare <= value;
					}
					else if(comparator == '$in') {
						return value.indexOf(compare) >= 0;
					}
					else if(comparator == '$not') {
						return compare != value;
					}
					else {
						debug('Unknown comparator `' + comparator + '`.');

						return false;
					}
				}).length;
			}
			else {
				return (compare === whereValue);
			}
		}).length;
	};

	var _parseModelInstance = function(stream, modelInstance) {
		if(_match(stream, modelInstance)) {
			return _sendModelInstances(stream, [
				modelInstance
			]);
		}
		else {
			debug('Model does not match stream\'s where map.');
		}
	};

	var _loadModelInstance = function(modelName, rowMap) {
		var model = models[modelName];
		var modelInstance = new ModelInstance(model, rowMap, null, rowMap.id, null, true, true, {});

		if(modelInstance._isPartial && model._containsAutoFetchProperty()) {
			// OK, so this creates potential scalability issues. But we cannot send incomplete model instances to the client.
			//
			// When model instances get created, they are considered partial because we're not automatically fetching all auto fetched associations. They are created from the result of the INSERT query.
			//
			// Because we're about to send the model instance to the client, and we found (a couple of) auto fetched associations, we re-fetch the model instance from the datastore.
			return model.findOne({id: modelInstance._id});
		}
		else {
			return Q.when(modelInstance);
		}
	};

	var _parseRow = function(modelName, rowMap) {
		debug('Streams#parseRow');

		var streams = _streams[modelName] || [];
		if(streams.length) {
			return _loadModelInstance(modelName, rowMap)
				.then(function(modelInstance) {
					var result = Q.when(true);

					streams.forEach(function(stream) {
						result = result.then(function() {
							return _parseModelInstance(stream, modelInstance);
						});
					});

					return result;
				});
		}
	};

	/**
	 * This is a delegate method from the connection.
	 */
	this.parseMessage = function(connection, messageMap) {
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
			_parseSubscribe(connection, messageMap);
		}
		else if(messageMap.msg == 'unsub') {
			_parseUnsubscribe(connection, messageMap);
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
}
