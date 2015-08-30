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
var watch = require('watch');

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

function getApp(stage) {
	var basePath = process.cwd();

	debug('loadApp ' + basePath + ' ' + stage);

	var packageJSON = require(path.join(basePath, 'package.json'));
	var index = packageJSON.main || 'index.js';

	unloadModules(basePath, index);

	// It's important we're retrieving the fire module used by the project. Not any global fire module.
	var firePath = path.join(basePath, 'node_modules', 'fire');

	var firestarter = require(firePath)._getFirestarter();
	firestarter._isStarting = false;
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
	var app = appContainer.getActiveApp();

	return firestarter.start()
		.then(function() {
			return app;
		});
}

function CLI(tasks) {
	var _doRun = function() {
		var _execute = function(cmd) {
			var postfix = '';
			if(process.platform == 'win32') {
				postfix = '.cmd';
			}

			return spawn(cmd + postfix, ['start'], {stdio: 'inherit'});
		};

		return _execute(path.join('node_modules', 'fire', 'node_modules', '.bin', 'nf'), ['start']);
	};

	var _doBuild = function(action, parameter) {
		return getApp('build')
			.then(function(app) {
				return app.injector
					.call(function(stageMethods) {
						return stageMethods.build(action, parameter);
					})
					.finally(function() {
						return app.stop();
					});
			});
	};

	var _doRelease = function(action, parameter) {
		return getApp('release')
			.then(function(app) {
				return app.injector
					.call(function(stageMethods) {
						return stageMethods.release(action, parameter);
					})
					.finally(function() {
						return app.stop();
					});
			});
	};

	var _doApp = function() {
		return createApp(tasks.shift() || '');
	};

	var _doDatastore = function(action) {
		if(action == 'create' || !action) {
			return createDatastore(tasks.shift());
		}
		else if(action == 'open') {
			var config = dotenv._load(dotenv.options({}));
			return runCommand('psql', [config.DATABASE_URL.value]);
		}
	};

	var _doServe = function() {
		var runProcess = null;
		var isBuilding = false;
		var buildAgain = false;
		var timer = null;

		var _run = function() {
			var _execute = function(cmd) {
				var postfix = '';
				if(process.platform == 'win32') {
					postfix = '.cmd';
				}

				return spawn(cmd + postfix, ['start'], {stdio: 'inherit'});
			};

			if(runProcess) {
				debug('Killing existing run process.');

				runProcess.once('close', function() {
					runProcess = null;
					_run();
				});

				// We're using (node-)foreman to run our app which explicitly listens to SIGINT to kill all of it's child processes.
				runProcess.kill('SIGINT');
				runProcess = null;
			}
			else {
				runProcess = _execute(path.join('node_modules', 'fire', 'node_modules', '.bin', 'nf'), ['start']);
			}

			process.once('close', function() {
				if(runProcess) {
					runProcess.kill('SIGINT');
					runProcess = null;
				}
			});
		};

		debug('Watching for changes on: ' + process.cwd());

		var _buildRestart = function() {
			debug('Starting build and restart');

			// Now, build everything. After the build, decide if we want to re-start.
			isBuilding = true;

			_doBuild()
				.then(function() {
					if(buildAgain) {
						debug('Another change, rebuilding');

						buildAgain = false;
						_buildRestart();
					}
					else {
						debug('Restart');

						isBuilding = false;
						return _run();
					}
				})
				.done();
		};

		watch.createMonitor(process.cwd(), {}, function(monitor) {
			var _filesChanged = function(file) {
				if(file.indexOf('/.fire/') == -1) {
					debug('File changed: `' + file + '`');

					if(isBuilding) {
						debug('Already building.');

						buildAgain = true;
					}
					else {
						debug('Setting timeout');

						if(timer) {
							clearTimeout(timer);
						}

						timer = setTimeout(_buildRestart, 250);
					}
				}
			};
			monitor.on('created', _filesChanged);
			monitor.on('changed', _filesChanged);
			monitor.on('removed', _filesChanged);
		});
		_buildRestart();
	};

	var _doConfig = function(action) {
		var config = {};
		if(action == 'get') {
			if(tasks.length) {
				config = dotenv._load(dotenv.options({}));
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
		else if(action == 'set') {
			if(tasks.length) {
				var newConfig = {};
				var index = 0;
				while(tasks.length > index) {
					var keyValue = tasks[index];
					var pair = keyValue.split('=');

					if(pair.length == 2) {
						newConfig[pair[0]] = pair[1];

						dotenv.set(pair[0], pair[1]);
					}
					else {
						console.log('Please specify a key-value pair joined with a = e.g. fire config:set KEY=value');
					}

					index++;
				}
				tasks = [];

				var newConfigLength = Object.keys(newConfig)
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

				Object.keys(newConfig).forEach(function(key) {
					console.log(key + ': ' + space(newConfigLength - key.length) + newConfig[key]);
				});
			}
			else {
				console.log('Please specify which config key-value to set e.g. fire config:set KEY=value');
			}
		}
		else if(!action) {
	        config = dotenv._load(dotenv.options({}));

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
	};

	var _showHelp = function() {
		var _show = function(message) {
			return message + space(32 - message.length);
		};

		console.log([
			'Usage: fire TOPIC[:ACTION[:PARAMETER]] ...',
			'',
			'List of topics and actions:',
			''
		].join('\n'));

		var meta = {
			'build': 'builds migrations, templates, and all other static assets',
			'build:version': 'sets the Node on Fire version in .fire/VERSION',
			'build:procfile': 'generates the Procfile with all processes',
			'build:templates': 'compiles all Jade templates in templates/',
			'build:less': 'compiles styles/default.less',
			'build:migrations': 'generates migrations based on model changes',
			'build:browserify': 'generates one bundle.js from all scripts',
			'build:scripts': 'generates all client-side javascript',
			'build:uglify': 'uglifies the bundle.js',
			'build:api': 'generates rest http api',

			'release': 'applies datastore migrations and creates A/B tests',
			'release:tests': 'prepares A/B tests',
			'release:migrate': 'applies all datastore migrations',
			'release:migrate:VERSION': 'applies datastore migrations, either up or down, till VERSION',

			'run': 'starts all processes of your app',

			'serve': 'runs your app, builds on changes, restarts and refreshes',

			'config': 'shows all local config key-value pairs (stored in .env)',
			'config:get KEY': 'shows the local config value of KEY',
			'config:set KEY=VALUE ...': 'sets the local config KEY to VALUE',

			'apps:create APP': 'creates a new app named APP',

			'datastore:create': 'creates a new local database, installs the uuid-ossp extension and sets the DATABASE_URL locally',
			'datastore:open': 'opens the current local database configured in DATABASE_URL',

			'version': 'shows the version of Node on Fire of this CLI',
			'help': 'shows this help'
		};

		console.log(Object.keys(meta).sort().map(function(key) {
			return [space(2), _show(key), '# ', meta[key]].join('');
		}).join('\n'));
		console.log('');
	};

	var _showVersion = function() {
		var packageJSON = require(path.join(__dirname, '..', 'package.json'));
		console.log(packageJSON.version);
	};

	var _runTask = function(task) {
		var topic, action, parameter;
		var parts = task.split(':');

		if(parts.length) {
			topic = parts[0];
		}

		if(parts.length > 1) {
			action = parts[1];
		}

		if(parts.length > 2) {
			parameter = parts[2];
		}

		debug('Execute ' + topic + ':' + action + ':' + parameter);

		if(topic == 'run') {
			return _doRun(action, parameter);
		}
		else if(topic == 'build') {
			return _doBuild(action, parameter);
		}
		else if(topic == 'release') {
			return _doRelease(action, parameter);
		}
		else if((topic == 'app' || topic == 'apps')) {
			return _doApp(action, parameter);
		}
		else if(topic == 'datastore' || topic == 'pg') {
			return _doDatastore(action, parameter);
		}
		else if(topic == 'serve') {
			return _doServe();
		}
		else if(topic == 'config') {
			return _doConfig(action, parameter);
		}
		else if(topic == 'version') {
			return _showVersion();
		}
		else if(topic == 'help') {
			return _showHelp();
		}
		else {
			console.log('Unknown topic `' + topic + '`.');
		}
	};

	var _run = function() {
		var task = tasks.shift();
		if(task) {
			return Q.when(_runTask(task))
				.then(function() {
					return _run();
				});
		}
	};

	if(tasks.length) {
		_run();
	}
	else {
		_showHelp();
	}
}

new CLI(argv._);
