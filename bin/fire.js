var minimist = require('minimist');
var argv = minimist(process.argv.slice(2));
var mu = require('mu2');
var path = require('path');
var Q = require('q');
var fs = require('fs');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var dotenv = require('dotenv-save');
var pg = require('pg');
var debug = require('debug')('fire:cli');

pg.defaults.poolIdleTimeout = 500;

function mkdir(dirPath) {
	debug('Creating directory `' + dirPath + '`');

	var defer = Q.defer();
	fs.mkdir(dirPath, defer.makeNodeResolver());
	return defer.promise;
}

function space(count) {
	return new Array(count + 1).join(' ');
}

function template(source, dest, options) {
	var readStream = mu.compileAndRender(path.join(__dirname, source), options);
	var defer = Q.defer();

	debug('Compiling and rendering `' + source + '` to `' + dest + '`.');

	var writeStream = fs.createWriteStream(dest);

	var errorCallback = function(error) {
		removeEventListeners();

		defer.reject(error);
	};
	var successCallback = function() {
		removeEventListeners();

		defer.resolve(false);
	};

	var removeEventListeners = function() {
		readStream.removeListener('end', successCallback);
		writeStream.removeListener('error', errorCallback);
		writeStream.removeListener('finish', successCallback);
	};

	writeStream.once('error', errorCallback);
	readStream.once('error', errorCallback);

	writeStream.once('finish', successCallback);

	readStream.pipe(writeStream);
	return defer.promise;
}

function runCommand(command, params, cwd) {
	var defer = Q.defer();

	var options = {};
	if(cwd) {
		options.cwd = cwd;
	}
	options.stdio = 'inherit';

	var commandProcess = spawn(command, params, options);
	commandProcess.on('exit', function(code, sig) {
		if(code > 0) {
			console.log('Uh-oh. Failed to run `' + command + '`.');

			defer.reject(new Error(code));
		}
		else {
			defer.resolve(sig);
		}
	});

	return defer.promise;
}

function createApp(name) {
	if(!name) {
		console.log('Please specify an app name.');
		return;
	}

	var postfix = '';
	if(process.platform == 'win32') {
		postfix = '.cmd';
	}

	return mkdir(name)
		.then(function() {
			return mkdir(path.join(name, 'templates'));
		})
		.then(function() {
			return Q.all([
				template('skeleton/index-js.template', name + '/index.js', {name: name}),
				template('skeleton/package-json.template', name + '/package.json', {name: name}),
				template('skeleton/env.template', name + '/.env', {sessionKey: crypto.randomBytes(127).toString('base64')}),
				template('skeleton/package-json.template', name + '/package.json', {name: name}),
				template('skeleton/view-jade.template', name + '/templates/view.jade', {}),
				template('skeleton/start-jade.template', name + '/templates/start.jade', {})
			]);
		})
		.then(function() {
			return runCommand('npm' + postfix, ['install'], path.join(process.cwd(), name));
		})
		.then(function() {
			console.log(' ');
			console.log('	Created app `' + name + '`. `cd ' + name + '` and run `fire run`.');
			console.log(' ');
		});
}

function _createDatabase(datastore, name, count) {
	var defer = Q.defer();
	var databaseName = name + (count ? count : '');

	datastore.query('CREATE DATABASE ' + databaseName, function(error) {
		if(error) {
			if(error.code == '42P04') {
				_createDatabase(datastore, name, count + 1)
					.then(function(n) {
						defer.resolve(n);
					})
					.catch(function(error2) {
						defer.reject(error2);
					})
					.done();
			}
			else {
				defer.reject(error);
			}
		}
		else {
			defer.resolve(databaseName);
		}
	});
	return defer.promise;
}

function createDatastore(name) {
	if(!name) {
		var packageJson = require(path.join(process.cwd(), 'package.json'));
		name = packageJson.name;
	}

	var user = process.env.USER;
	var host = '127.0.0.1';
	var port = 5432;

	var databaseUrl = 'postgres://' + user + '@' + host + ':' + port + '/' + 'template1';

	// We have to connect to a database to create a database. So let's test if we can access the template database, see http://www.postgresql.org/docs/9.3/static/manage-ag-templatedbs.html.
	pg.connect(databaseUrl, function(error, datastore, done) {
		if(error) {
			throw new Error('Cannot connect to datastore at `' + databaseUrl + '`.');
		}
		else {
			_createDatabase(datastore, name, 0)
				.then(function(databaseName) {
					done();

					databaseUrl = 'postgres://' + user + '@' + host + ':' + port + '/' + databaseName;
					pg.connect(databaseUrl, function(error3, datastore2, done2) {
						if(error3) {
							console.log(error3);
						}
						else {
							datastore2.query('CREATE EXTENSION "uuid-ossp";', function(error4) {
								done2();

								if(error4) {
									console.log(error4);
								}
								else {
									dotenv.set('DATABASE_URL', databaseUrl);

									console.log('DATABASE_URL: ' + databaseUrl);
								}
							});
						}
					});
				})
				.catch(function(error2) {
					console.log(error2);
				})
				.done();
		}
	}.bind(this));
}

function unloadModules(basePath, index) {
	debug('unloadModules ' + basePath);

	var name = require.resolve('fire');
	if(typeof require.cache[name] != 'undefined') {
		delete require.cache[name];
	}

	name = path.join(basePath, 'node_modules', 'fire');
	if(typeof require.cache[name] != 'undefined') {
		delete require.cache[name];
	}

	var moduleName = require.resolve(path.join(basePath, index));
	if(typeof require.cache[moduleName] != 'undefined') {
		delete require.cache[moduleName];
	}

	Object.keys(require.cache).forEach(function(requireName) {
		// We destroy the cache of all files in the projects, except any libraries.
		if(requireName.indexOf(basePath) === 0 && requireName.indexOf('node_modules') == -1) {
			delete require.cache[requireName];
		}
	});
}

function loadApp(basePath, stage) {
	debug('loadApp ' + basePath + ' ' + stage);

	var packageJSON = require(path.join(basePath, 'package.json'));
	var index = packageJSON.main || 'index.js';

	unloadModules(basePath, index);

	// It's important we're retrieving the fire module used by the project. Not any global fire module.
	var firePath = path.join(basePath, 'node_modules', 'fire');

	var firestarter = require(firePath)._getFirestarter();
	firestarter.stage = stage;
	firestarter.disabled = true;
	firestarter.appsContainerMap = {};

	require(path.join(basePath, index));

	var appContainerIds = Object.keys(firestarter.appsContainerMap);
	if(appContainerIds.length > 1) {
		throw new Error('More than 1 app container found. This is currently not supported. You can create multiple apps by using the same id but different names. Please check `fire#app()`.');
	}
	else if(!appContainerIds.length) {
		throw new Error('Could not find any app. Did you create an app in ' + index + ' (this is your main entry point specified in your package.json)? Is the current working directory correct?');
	}

	var appContainer = firestarter.appsContainerMap[appContainerIds[0]];
	return appContainer.getActiveApp();
}

function getApp(stage) {
	var basePath = process.cwd();
	var app = loadApp(basePath, stage);
	var defer = Q.defer();
	setImmediate(function() {
		defer.resolve(app);
	});
	return defer.promise;
}

if(argv._.length) {
	var tasks = argv._;
	var _runTask = function(firstTask) {
		var topic, task, parameter;
		var parts = firstTask.split(':');

		if(parts.length) {
			topic = parts[0];
		}

		if(parts.length > 1) {
			task = parts[1];
		}

		if(parts.length > 2) {
			parameter = parts[2];
		}

		debug('Execute ' + topic + ':' + task + ':' + parameter);

		if(topic == 'run') {
			var _execute = function(cmd) {
		        var postfix = '';
				if(process.platform == 'win32') {
					postfix = '.cmd';
				}

		        return spawn(cmd + postfix, ['start'], {stdio: 'inherit'});
		    };

	        return _execute(path.join('node_modules', 'fire', 'node_modules', '.bin', 'nf'), ['start']);
		}
		else if(topic == 'build') {
			return getApp('build')
				.then(function(app) {
					return app.injector
						.call(function(stageMethods) {
							return stageMethods.build(task, parameter);
						})
						.finally(function() {
							return app.stop();
						});
				});
		}
		else if(topic == 'release') {
			return getApp('release')
				.then(function(app) {
					return app.injector
						.call(function(stageMethods) {
							return stageMethods.release(task, parameter);
						})
						.finally(function() {
							return app.stop();
						});
				});
		}
		else if((topic == 'app' || topic == 'apps') && (!task || task == 'create')) {
			return createApp(argv._[1] || '');
		}
		else if(topic == 'datastore' && (!task || task == 'create')) {
			return createDatastore(tasks.shift());
		}
		else if(topic == 'datastore' && task == 'open') {
			
		}
		else if(topic == 'config' && topic == 'get') {
			if(tasks.length) {
				var config = dotenv._load(dotenv.options({}));
				var configKey = tasks.splice(0, 1)[0];
				if(config[configKey]) {
					console.log(config[configKey].value);
				}
				else {
					console.log('');
				}
			}
			else {
				console.log('Please specify which config to get e.g. fire config:get KEY.');
			}
		}
		else if(topic == 'config' && task == 'set') {
			if(tasks.length) {
				var configMap = {};

				var index = 0;
				while(tasks.length > index) {
					var keyValue = tasks[index];
					var pair = keyValue.split('=');

					if(pair.length == 2) {
						configMap[pair[0]] = pair[1];

						dotenv.set(pair[0], pair[1]);
					}
					else {
						console.log('Please specify a key-value pair joined with a = e.g. fire config:set KEY=value');
					}

					index++;
				}
				tasks = [];

				var length = Object.keys(configMap)
					.map(function(key) {
						return key.length;
					})
					.reduce(function(last, now) {
						if(last >= now) {
							return last;
						}
						else {
							return now;
						}
					}, 0);

				Object.keys(configMap).forEach(function(key) {
					console.log(key + ': ' + space(length - key.length) + configMap[key]);
				});
			}
			else {
				console.log('Please specify which config key-value to set e.g. fire config:set KEY=value');
			}
		}
		else if(topic == 'config' && !task) {
	        var config = dotenv._load(dotenv.options({}));

			var length = Object.keys(config)
				.map(function(key) {
					return key.length;
				})
				.reduce(function(last, now) {
					if(last >= now) {
						return last;
					}
					else {
						return now;
					}
				}, 0);

			Object.keys(config).forEach(function(key) {
				console.log(key + ': ' + space(length - key.length) + config[key].value);
			});
		}
		else {
			console.log('Unknown task `' + firstTask + '`.');
		}
	};

	var _run = function() {
		var firstTask = tasks.shift();
		if(firstTask) {
			return Q.when(_runTask(firstTask))
				.then(function() {
					return _run();
				});
		}
	};

	_run()
		.then(function() {
			debug('Finished!');
		})
		.catch(function(error) {
			console.log(error);
			console.log(error.stack);
		})
		.done();
}
else {
	// show help
}
