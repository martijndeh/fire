exports = module.exports = new Build();

var path = require('path');
var fs = require('fs');
var Q = require('q');

function mkdir(dirPath) {
	var defer = Q.defer();
	fs.mkdir(dirPath, function() {
		defer.resolve(true);
	});
	return defer.promise;
}

function unloadModules(basePath) {
	var name = require.resolve('fire');
	if(typeof require.cache[name] != 'undefined') {
		delete require.cache[name];
	}

	var moduleName = require.resolve(path.join(basePath, 'index.js'));
	if(typeof require.cache[moduleName] != 'undefined') {
		delete require.cache[moduleName];
	}

	Object.keys(require.cache).forEach(function(requireName) {
		if(requireName.indexOf(basePath) === 0) {
			delete require.cache[requireName];
		}
	});
}

function loadApp(basePath, stage) {
	unloadModules(basePath);

	var fire = require('../../../');
	fire.stage = stage;
	fire.disabled = true;
	fire.appsContainerMap = {};

	require(path.join(basePath, 'index.js'));

	var appContainerIds = Object.keys(fire.appsContainerMap);
	if(appContainerIds.length > 1) {
		throw new Error('More than 1 app container found. This is currently not supported. You can create multiple apps by using the same id but different names. Please check `fire#app()`.');
	}
	if(!appContainerIds.length) {
		throw new Error('Could not find any app. Did you create an app in index.js by calling `fire#app()`? Is the current working directory correct?');
	}

	var appContainer = fire.appsContainerMap[appContainerIds[0]];
	return appContainer.getActiveApp();
}

function Build() {
	this.app = null;
}

Build.prototype.extendConfig = function(gruntConfig, grunt) {
	if(!gruntConfig.firebuild) {
		gruntConfig.firebuild = {};
	}

	gruntConfig.firebuild.migrations = {};
	gruntConfig.firebuild.api = {};
	gruntConfig.firebuild.scripts = {};
	gruntConfig.firebuild.procfile = {};
	gruntConfig.firebuild.version = {};

	var optionsApp = loadApp(process.cwd());

	this.app = optionsApp;

	if(optionsApp.container.numberOfApps() == 1) {
		gruntConfig.less = {
			options: {
				compress: true,
				sourceMap: false
			},
			src: {
				expand: true,
				src: ['./styles/*.less'],
				dest: '.fire/public/',
				ext: '.css'
			}
		};

		gruntConfig.jade = {
			compile: {
				options: {
					data: optionsApp._settings
				},
				files: [{
					expand: true,
					src: 'templates/**/*.jade',
					dest: '.fire/public/',
					ext: '.html'
				}]
			}
		};

		gruntConfig.uglify = {
			options: {
				sourceMap: true
			},
			build: {
				src: '.fire/public/scripts/fire.js',
				dest: '.fire/public/scripts/fire.min.js'
			}
		};
	}
	else {
		gruntConfig.less = {
			options: {
				compress: true,
				sourceMap: false
			},
			_shared: {
				dest: '.fire/public/styles/default.css',
				src: 'styles/_shared/default.less'
			}
		};

		gruntConfig.less[optionsApp.name] = {
			src: 'styles/' + optionsApp.name + '/default.less',
			dest: '.fire/public/' + optionsApp.name + '/styles/default.css'
		};

		gruntConfig.jade = {
			compile: {
				options: {
					data: optionsApp._settings
				},
				files: [{
					expand: true,
					cwd: 'templates/_shared/',
					src: '**/*.jade',
					dest: '.fire/public/' + optionsApp.name + '/templates/',
					ext: '.html'
				}, {
					expand: true,
					cwd: 'templates/' + optionsApp.name + '/',
					src: '**/*.jade',
					dest: '.fire/public/' + optionsApp.name + '/templates/',
					ext: '.html'
				}]
			}
		};

		gruntConfig.uglify = {
			options: {
				sourceMap: true
			},
			build: {
				src: '.fire/public/' + optionsApp.name + '/scripts/fire.js',
				dest: '.fire/public/' + optionsApp.name + '/scripts/fire.min.js'
			}
		};
	}

	if(!gruntConfig.release) {
		gruntConfig.release = {};
	}

	gruntConfig.release.migrate = {};
	gruntConfig.release.tests = {};

	if(!gruntConfig.run) {
		gruntConfig.run = {};
	}

	grunt.registerMultiTask('release', function(version) {
		var dotenv = require('dotenv');
		dotenv.load();

		var Migrations = require('../migrations');

		var basePath = process.cwd();
		var app = loadApp(basePath, 'release');

		app.models.forEach(function(model, modelName) {
			delete app.models.internals[modelName];
			delete app.models[modelName];
		});

		var done = this.async();

		if(this.target == 'tests') {
			app.controllers.setup(basePath)
				.then(function() {
					return app.models.setup(basePath);
				})
				.then(function() {
					return app.tests.setup(basePath);
				})
				.then(function() {
					return app.tests.createTests();
				})
				.then(done)
				.catch(done)
				.done();
		}
		else if(this.target == 'migrate') {
			var models = app.models;
			var migrations = new Migrations(app, models);

			var targetVersion = version;

			// Set-up without reading any of the models
			// We will create the models based on all migrations

			models.setup(null)
				.then(function() {
					return migrations.setup(app.container.numberOfApps() > 1 ? path.join(basePath, '.fire', 'migrations', app.name) : path.join(basePath, '.fire', 'migrations'));
				})
				.then(function() {
					if(migrations._.length === 0) {
						console.log('Warning: there are 0 migration files. Did you run `grunt build`? Continuing anyway...');
					}
					else {
						return migrations.currentVersion()
							.then(function(currentVersion) {
								if(!targetVersion) {
									targetVersion = migrations._[migrations._.length - 1].version;
								}

								if(targetVersion == currentVersion) {
									console.log('*** Database is up-to-date.');
								}
								else {
									console.log('*** Migrating from `' + currentVersion + '` to `' + targetVersion + '`.');

									return migrations.migrate(currentVersion, targetVersion)
										.then(function() {
											return migrations.currentVersion();
										})
										.then(function(newVersion) {
											if(newVersion == targetVersion) {
												//everything went alright
												console.log('*** Migration successful to `' + targetVersion + '`.');
											}
											else {
												throw new Error('Database version after migration `' + newVersion + '` does not match target version `' + targetVersion + '`.');
											}
										});
								}
							});
					}
				})
				.then(function() {
					done();
				})
				.catch(function(error) {
					console.log(error.message);
					console.log(error.stack);

					throw error;
				})
				.done();
		}
	});

	grunt.registerMultiTask('firebuild', function() {
		var done = this.async();
		var basePath = process.cwd();
		var app = null;

		if(this.target == 'version') {
			var packageJSON = require(path.join(__dirname, '..', '..', '..', 'package.json'));

			fs.writeFile(path.join('.fire', 'VERSION'), packageJSON.version, function(error) {
				done(error);
			});
		}
		else if(this.target == 'procfile') {
			app = loadApp(basePath, 'build');

			var processes = [];
			processes.push('web: node index.js --web');

			if(app.workers.numberOfWorkers() > 0) {
				processes.push('worker: node index.js --workers');
			}

			if(app.schedulers.numberOfSchedulers() > 0) {
				processes.push('worker: node index.js --schedulers');
			}

			if(app.triggers.numberOfTriggers() > 0) {
				processes.push('worker: node index.js --triggers');
			}

			if(app.triggers.numberOfTriggers() > 0 || app.schedulers.numberOfSchedulers() > 0) {
				processes.push('clock: node index.js --clock');
			}

			fs.writeFile('Procfile', processes.join('\n'), function(error) {
				done(error);
			});
		}
		else if(this.target == 'migrations') {
			app = loadApp(basePath, 'build');

			mkdir(path.join(basePath, '.fire'))
				.then(function() {
					return mkdir(path.join(basePath, '.fire', 'migrations'));
				})
				.then(function() {
					if(app.container.numberOfApps() > 1) {
						return mkdir(path.join(basePath, '.fire', 'migrations', app.name));
					}
				})
				.then(function() {
					var Generate = require('../migrations/generate');
					var generate = new Generate(app, basePath);
					generate.delegate = {
						addMigration: function(fileName, stream) {
							var savePath = (app.container.numberOfApps() > 1 ? path.join(basePath, '.fire', 'migrations', app.name, fileName) : path.join(basePath, '.fire', 'migrations', fileName));

							var writeStream = fs.createWriteStream(savePath);
							stream.pipe(writeStream);

							writeStream.once('finish', function() {
								done();
							});
						}
					};

					return generate.createMigrations(true);
				})
				.then(function(result) {
					if(!result) {
						// If the result is false, there are no migrations so we'll call done.
						done();
					}
				})
				.done();
		}
		else if(this.target == 'api') {
			app = loadApp(basePath, 'build');

			app.controllers.setup(basePath)
				.then(function() {
					return app.models.setup(basePath);
				})
				.then(function() {
					return mkdir(path.join(basePath, '.fire'));
				})
				.then(function() {
					return mkdir(path.join(basePath, '.fire', 'api'));
				})
				.then(function() {
					if(app.container.numberOfApps() > 1) {
						return mkdir(path.join(basePath, '.fire', 'api', app.name));
					}
				})
				.then(function() {
					var result = Q.when(true);

					app.models.forEach(function(model) {
						result = result.then(function() {
							if(model.isShared() && !app.settings('isMaster') && !app.settings('includeAPI')) {

							}
							else {
								var savePath = (app.container.numberOfApps() > 1) ? path.join(basePath, '.fire', 'api', app.name, model.getFileName() + '.js') : path.join(basePath, '.fire', 'api', model.getFileName() + '.js'); 
								var writeStream = fs.createWriteStream(savePath);
								return app.API.generateModelController(model, writeStream);
							}
						});
					});

					return result;
				})
				.then(function() {
					done();
				})
				.done();
		}
		else if(this.target == 'scripts') {
			app = loadApp(basePath, 'build');

			app.controllers.setup(basePath)
				.then(function() {
					return app.models.setup(basePath);
				})
				.then(function() {
					return app.tests.setup(basePath);
				})
				.then(function() {
					setImmediate(function() {
						return mkdir(path.join(basePath, '.fire'))
							.then(function() {
								return mkdir(path.join(basePath, '.fire', 'public'));
							})
							.then(function() {
								if(app.container.numberOfApps() > 1) {
									return mkdir(path.join(basePath, '.fire', 'public', app.name));
								}
							})
							.then(function() {
								if(app.container.numberOfApps() > 1) {
									return mkdir(path.join(basePath, '.fire', 'public', app.name, 'scripts'));
								}
								else {
									return mkdir(path.join(basePath, '.fire', 'public', 'scripts'));
								}
							})
							.then(function() {
								var savePath = (app.container.numberOfApps() > 1) ? path.join(basePath, '.fire', 'public', app.name, 'scripts', 'fire.js') : path.join(basePath, '.fire', 'public', 'scripts', 'fire.js');
								var writeStream = fs.createWriteStream(savePath);

								app.bridge.generate(writeStream)
									.then(function() {
										done();
									})
									.done();
							});
					});
				})
				.done();
		}
		else {
			done();
		}
	});

	grunt.registerTask('build', ['firebuild', 'less', 'jade', 'uglify']);
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jade');
	return gruntConfig;
};
