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
	var str = '';
	while(count--) {
		str += ' ';
	}
	return str;
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

	mkdir(name)
		.then(function() {
			return mkdir(path.join(name, 'templates'));
		})
		.then(function() {
			return Q.all([
				template('skeleton/index-js.template', name + '/index.js', {name: name}),
				template('skeleton/package-json.template', name + '/package.json', {name: name}),
				template('skeleton/env.template', name + '/.env', {sessionKey: crypto.randomBytes(127).toString('base64')}),
				template('skeleton/package-json.template', name + '/package.json', {name: name}),
				template('skeleton/Gruntfile-js.template', name + '/Gruntfile.js', {}),
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
		})
		.catch(function(error) {
			console.log(error);
		})
		.done();
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

if(argv._.length) {
	var command, subcommand;

	var commands = argv._[0].split(':');

	if(commands.length) {
		command = commands[0];
	}

	if(commands.length > 1) {
		subcommand = commands[1];
	}

	var postfix = '';
	if(process.platform == 'win32') {
		postfix = '.cmd';
	}

	var gruntPath = path.join('node_modules', '.bin', 'grunt' + postfix);
	if(command == 'run') {
		runCommand(gruntPath, ['run']);
	}
	else if(command == 'build') {
		runCommand(gruntPath, ['build']);
	}
	else if(command == 'release') {
		runCommand(gruntPath, ['release']);
	}
	else if((command == 'app' || command == 'apps') && (!subcommand || subcommand == 'create')) {
		createApp(argv._[1] || '');
	}
	else if(command == 'datastore' && (!subcommand || subcommand == 'create')) {
		createDatastore(argv._[1]);
	}
	else if(command == 'config' && subcommand == 'get') {
		if(argv._.length > 1) {
			var config = dotenv._load(dotenv.options({}));
			if(config[argv._[1]]) {
				console.log(config[argv._[1]].value);
			}
			else {
				console.log('');
			}
		}
		else {
			console.log('Please specify which config to get e.g. fire config:get KEY.');
		}
	}
	else if(command == 'config' && subcommand == 'set') {
		if(argv._.length > 1) {
			var config = {};

			var index = 1;
			while(argv._.length > index) {
				var keyValue = argv._[index];
				var pair = keyValue.split('=');

				if(pair.length == 2) {
					config[pair[0]] = pair[1];

					dotenv.set(pair[0], pair[1]);
				}
				else {
					console.log('Please specify a key-value pair joined with a = e.g. fire config:set KEY=value');
				}

				index++;
			}

			var length = Object.keys(config).map(function(key) {
				return key.length;
			}).reduce(function(last, now) {
				if(last >= now) {
					return last;
				}
				else {
					return now;
				}
			}, 0);

			Object.keys(config).forEach(function(key) {
				console.log(key + ': ' + space(length - key.length) + config[key]);
			});
		}
		else {
			console.log('Please specify which config key-value to set e.g. fire config:set KEY=value');
		}
	}
	else if(command == 'config' && !subcommand) {
        var config = dotenv._load(dotenv.options({}));

		var length = Object.keys(config).map(function(key) {
			return key.length;
		}).reduce(function(last, now) {
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
		console.log('Unknown command `' + command + '`.');
	}
}
else {
	// show help
}
