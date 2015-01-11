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

function loadApp(basePath) {
	unloadModules(basePath);

	var fire = require('../../../');
	fire.disabled = true;
	fire.appsMap = {};

	require(path.join(basePath, 'index.js'));

	return fire.app(Object.keys(fire.appsMap)[0]);
}

function Build() {

}

Build.prototype.extendConfig = function(gruntConfig, grunt) {
	if(!gruntConfig.firebuild) {
		gruntConfig.firebuild = {};
	}

	gruntConfig.firebuild.migrations = {};
	gruntConfig.firebuild.api = {};
	gruntConfig.firebuild.scripts = {};

	var optionsApp = loadApp(process.cwd());

	gruntConfig.less = {
		options: {
			compress: true,
			sourceMap: true
		},
		src: {
			expand: true,
			src: ['./styles/*.less'],
			dest: 'public/',
			ext: '.css'
		}
	};

	gruntConfig.jade = {
		compile: {
			options: {
				data: optionsApp._options
			},
			files: [{
				expand: true,
				src: 'templates/**/*.jade',
				dest: 'public/',
				ext: '.html'
			}]
		}
	};

	gruntConfig.uglify = {
		options: {
			sourceMap: true
		},
		build: {
			src: 'public/scripts/fire.js',
			dest: 'public/scripts/fire.min.js'
		}
	};

	if(!gruntConfig.release) {
		gruntConfig.release = {};
	}

	gruntConfig.release.migrate = {};

	if(!gruntConfig.run) {
		gruntConfig.run = {};
	}

	grunt.registerMultiTask('release', function(version) {
		var dotenv = require('dotenv');
		dotenv.load();

		var Migrations = require('../migrations');

		var basePath = process.cwd();
		var app = loadApp(basePath);

		app.models.forEach(function(model, modelName) {
			delete app.models.internals[modelName];
			delete app.models[modelName];
		});

		var models = app.models; //new Models(app);
		var migrations = new Migrations();

		var targetVersion = version;

		var done = this.async();

		// Set-up without reading any of the models
		// We will create the models based on all migrations

		models.setup(null)
			.then(function() {
				return migrations.setup(path.join(basePath, '_migrations'), models);
			})
			.then(function() {
				if(migrations._.length === 0) {
					throw new Error('There are 0 migration files. Did you run `fire generate migrations`?');
				}
			})
			.then(function() {
				// Let's find which database version we're at
				return migrations.currentVersion();
			})
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
	});

	grunt.registerMultiTask('firebuild', function() {
		var done = this.async();
		var basePath = process.cwd();

		var app = loadApp(basePath);

		if(this.target == 'migrations') {
			mkdir(path.join(basePath, '_migrations'))
				.then(function() {
					var Generate = require('../migrations/generate');
					var generate = new Generate(app, basePath);
					generate.delegate = {
						addMigration: function(fileName, stream) {
							var writeStream = fs.createWriteStream(path.join(basePath, '_migrations', fileName));
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
			app.controllers.setup(basePath)
				.then(function() {
					return app.models.setup(basePath);
				})
				.then(function() {
					var defer = Q.defer();

					setImmediate(function() {
						fs.mkdir(path.join(basePath, '_api'), function() {
							defer.resolve();
						});
					});

					return defer.promise;
				})
				.then(function() {
					var result = Q.when(true);

					app.models.forEach(function(model) {
						result = result.then(function() {
							var writeStream = fs.createWriteStream(path.join(basePath, '_api', model.getFileName() + '.js'));
							return app.API.generateModelController(model, writeStream);
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
			app.controllers.setup(basePath)
				.then(function() {
					return app.models.setup(basePath);
				})
				.then(function() {
					setImmediate(function() {
						return mkdir(path.join(basePath, 'public'))
							.then(function() {
								return mkdir(path.join(basePath, 'public', 'scripts'));
							})
							.then(function() {
								var writeStream = fs.createWriteStream(path.join(basePath, 'public', 'scripts', 'fire.js'));

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

	grunt.registerTask('build', ['less', 'jade', 'firebuild', 'uglify']);
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jade');
	return gruntConfig;
};
