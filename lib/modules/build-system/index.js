'use strict';

var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var utils = require('../../helpers/utils');
var lss = require('less');
var jde = require('jade');
var UglifyJS = require('uglify-js');
var brwserify = require('browserify');
var Migrations = require('../migrations');
var Q = require('q');

exports = module.exports = BuildSystem;

function BuildSystem(stageMethods, $q) {
    var basePath = process.cwd();

    var _mkdir = function(directoryPath) {
        var defer = $q.defer();
        mkdirp(directoryPath, function(error) {
            if(error) {
                defer.reject(error);
            }
            else {
                defer.resolve(directoryPath);
            }
        });
        return defer.promise;
    };

    /**
     * fire build:scripts
     */
    stageMethods.addMethod('build', function scripts(app) {
        var scriptsPath = '';

        if(app.container.numberOfApps() > 1) {
            scriptsPath = path.join(basePath, '.fire', '.build', 'public', app.name, 'scripts');
        }
        else {
            scriptsPath = path.join(basePath, '.fire', '.build', 'public', 'scripts');
        }

        return _mkdir(scriptsPath)
            .then(function() {
                var savePath = path.join(scriptsPath, 'fire.js');
                var writeStream = fs.createWriteStream(savePath);

                console.log('bridge#generate');

                return app.bridge.generate(writeStream);
            });
    });

    /*
     * fire build:api
     */
    stageMethods.addMethod('build', function api(app) {
        var apiPath = '';

        if(app.container.numberOfApps() > 1) {
            apiPath = path.join(basePath, '.fire', '.build', 'api', app.name);
        }
        else {
            apiPath = path.join(basePath, '.fire', '.build', 'api');
        }

        return _mkdir(apiPath)
            .then(function() {
                var result = $q.when(true);

                app.models.forEach(function(model) {
                    result = result.then(function() {
                        if(model.isShared() && !app.settings('isMaster') && !app.settings('includeAPI')) {
                            //
                        }
                        else {
                            var savePath = path.join(apiPath, model.getFileName() + '.js');
                            var writeStream = fs.createWriteStream(savePath);
                            return app.APIBuild.generateModelController(model, writeStream);
                        }
                    });
                });

                return result;
            });
    });

    /*
     * fire build:migrations
     */
    stageMethods.addMethod('build', function migrations(app) {
        var migrationsPath = '';
        if(app.container.numberOfApps() > 1) {
            migrationsPath = path.join(basePath, '.fire', 'migrations', app.name);
        }
        else {
            migrationsPath = path.join(basePath, '.fire', 'migrations');
        }

        var defer = $q.defer();
        _mkdir(migrationsPath)
            .then(function() {
                var Generate = require('../migrations/generate');
                var generate = new Generate(app, basePath);
                generate.delegate = {
                    addMigration: function(fileName, stream) {
                        var savePath = path.join(migrationsPath, fileName);

                        var writeStream = fs.createWriteStream(savePath);
                        stream.pipe(writeStream);

                        writeStream.once('finish', function() {
                            defer.resolve();
                        });
                    }
                };

                return generate.createMigrations(true);
            })
            .then(function(result) {
                if(!result) {
                    // If the result is false, there are no migrations so we'll call done.
                    defer.resolve();
                }
            })
            .done();
        return defer.promise;
    });

    /*
     * fire build:procfile
     */
    stageMethods.addMethod('build', function procfile(app) {
        var processes = [];
        processes.push('web: node index.js --web');

        if(app.workers.numberOfWorkers() > 0) {
            processes.push('workers: node index.js --workers');
        }

        if(app.schedulers.numberOfSchedulers() > 0) {
            processes.push('schedulers: node index.js --schedulers');
        }

        if(app.triggers.numberOfTriggers() > 0) {
            processes.push('triggers: node index.js --triggers');
        }

        if(app.triggers.numberOfTriggers() > 0 || app.schedulers.numberOfSchedulers() > 0) {
            processes.push('clock: node index.js --clock');
        }

        var savePath = path.join(basePath, 'Procfile');

        var contents = fs.readFileSync(savePath, {encoding: 'utf8'});
        var newContents = processes.join('\n');
        if(contents != newContents) {
            var defer = $q.defer();
            fs.writeFile(savePath, newContents, defer.makeNodeResolver());
            return defer.promise;
        }
    });

    /*
     * fire build:version
     */
    stageMethods.addMethod('build', function version() {
        return _mkdir(path.join('.fire'))
            .then(function(savePath) {
                var packageJSON = require(path.join(__dirname, '..', '..', '..', 'package.json'));
                var defer = $q.defer();
                fs.writeFile(path.join(savePath, 'VERSION'), packageJSON.version, defer.makeNodeResolver());
                return defer.promise;
            });
    });

    /*
     * fire build:less
     */
    stageMethods.addMethod('build', function less(app) {
        // TODO: Compile all *.less files in styles/.
        // TODO: Somehow configure this from user-land.

        var lessPath = '';
        var buildPath = '';
        if(app.container.numberOfApps() > 1) {
            lessPath = path.join(basePath, 'styles', app.name);
            buildPath = path.join(basePath, '.fire', '.build', 'public', app.name, 'styles');
        }
        else {
            lessPath = path.join(basePath, 'styles');
            buildPath = path.join(basePath, '.fire', '.build', 'public', 'styles');
        }

        try {
            var data = fs.readFileSync(path.join(lessPath, 'default.less'), {encoding: 'utf8'});
            return _mkdir(lessPath)
                .then(function() {
                    return _mkdir(buildPath);
                })
                .then(function() {
                    return lss.render(data, {
                        filename: path.join(lessPath, 'default.less')
                    });
                })
                .then(function(output) {
                    fs.writeFileSync(path.join(buildPath, 'default.css'), output.css);
                });
        }
        catch(e) {
            if(e.errno == -2 && e.code == 'ENOENT') {
                // We don't have a default.less. Let's not do anything.
            }
            else {
                var defer = Q.defer();
                defer.reject(e);
                return defer.promise;
            }
        }

    });

    /*
     * fire build:templates
     */
    stageMethods.addMethod('build', function templates(app) {
        var data = app._settings || {};
    	data._fire = {
    		appName: app.name
    	};

        var templatesPath = '';
        var buildPath = '';
        if(app.container.numberOfApps() > 1) {
            templatesPath = path.join(basePath, 'templates', app.name);
            buildPath = path.join(basePath, '.fire', '.build', 'public', app.name, 'templates');
        }
        else {
            buildPath = path.join(basePath, '.fire', '.build', 'public', 'templates');
            templatesPath = path.join(basePath, 'templates');
        }

        return _mkdir(buildPath)
            .then(function() {
                var result = $q.when(true);

                var _loadTemplate = function(jadePath) {

                    var extension = path.extname(jadePath);
                    var baseName = path.basename(jadePath, extension);
                    var destPath = path.join(buildPath, baseName + '.html');

                    if(extension == '.jade') {
                        var html = jde.renderFile(jadePath, data);
                        fs.writeFileSync(destPath, html);
                    }
                    else if(extension == '.html') {
                        var readStream = fs.createReadStream(jadePath);
                        var writeStream = fs.createWriteStream(destPath);

                        // TODO: Add error handling here.

                        readStream.pipe(writeStream);
                    }
                    else {
                        throw new Error('Unknown extension `' + extension + '` in template.');
                    }
                };

                utils.readDirSync(templatesPath, _loadTemplate);
                utils.readDirSync(path.join(basePath, '_shared'), _loadTemplate);
                return result;
            });
    });

    /*
     * fire build:browserify
     */
    stageMethods.addMethod('build', function browserify(app) {
        var b = brwserify();

        b.add(path.join('node_modules', 'angular', 'index.js'));

    	(app.settings('modules') || []).forEach(function(moduleName) {
            try {
                // If the package.json does not exist, this will throw an exception.
                var packageJSON = require(path.join(basePath, 'node_modules', moduleName, 'package.json'));
                b.add(path.join('node_modules', moduleName, packageJSON.main || 'index.js'));
            }
            catch(e) {
                // We just assume index.js is the main entry point of the module.
                b.add(path.join('node_modules', moduleName, 'index.js'));
            }
    	});

    	(app.settings('require') || []).forEach(function(requireName) {
            b.add(requireName);
        });

        if(app.container.numberOfApps() > 1) {
            b.add('.fire/.build/public/' + app.name + '/scripts/fire.js');
        }
        else {
            b.add('.fire/.build/public/scripts/fire.js');
        }

        var defer = $q.defer();

        var savePath = '';
        if(app.container.numberOfApps() > 1) {
            savePath = path.join(basePath, '.fire', '.build', 'public', app.name, 'scripts');
        }
        else {
            savePath = path.join(basePath, '.fire', '.build', 'public', 'scripts');
        }

        var writeStream = fs.createWriteStream(path.join(savePath, 'bundle.js'));
        writeStream.on('finish', function() {
            defer.resolve();
        });
        writeStream.on('error', function(error) {
            defer.reject(error);
        });

        b.bundle().pipe(writeStream);
        return defer.promise;
    });

    /*
     * fire build:uglify
     */
    stageMethods.addMethod('build', function uglify(app) {
        var srcPath = '';
        var destPath = '';

        if(app.container.numberOfApps() > 1) {
            srcPath = path.join(basePath, '.fire', '.build', 'public', app.name, 'scripts');
        }
        else {
            srcPath = path.join(basePath, '.fire', '.build', 'public', 'scripts');
        }

        destPath = srcPath;

        if(process.env.NODE_ENV == 'development' && !process.env.BUILD_UGLIFY) {
            // Skipping build:uglify because we're in development.
            try {
                fs.unlinkSync(path.join(destPath, 'bundle.min.js'));
            }
            catch(e) {
                if(e.errno == -2 && e.code == 'ENOENT') {
                    // The file does not exist. No worries.
                }
                else {
                    // We re-throw any other exception.
                    throw e;
                }
            }
        }
        else {
            return _mkdir(destPath)
                .then(function() {
                    var result = UglifyJS.minify([path.join(srcPath, 'bundle.js')]);
                    fs.writeFileSync(path.join(destPath, 'bundle.min.js'), result.code);
                });
        }
    });

    /**
     * fire release:tests
     */
    stageMethods.addMethod('release', function tests(app) {
        if(!process.env.DATABASE_URL) {
            console.log('Warning: running `grunt release` but no DATABASE_URL set.');
        }
        else {
            return app.tests.createTests();
        }
    });

    /**
     * fire release:migrate
     * fire release:migrate:VERSION
     */
    stageMethods.addMethod('release', function migrate(app, parameter) {
        if(!process.env.DATABASE_URL) {
            console.log('Warning: running `fire release` but no DATABASE_URL set.');
        }
        else {
            var version = parameter;
            var firestarter = require('../../..')._getFirestarter();
            var newApp = firestarter.app(app.container.id, app.name + '-new', app._settings);
        	newApp.models.isSetupPrevented = true;

        	delete app.container.appsMap[newApp.name];

            var models = newApp.models;
			var migrations = new Migrations(newApp, models);

			var targetVersion = version;

			// Set-up without reading any of the models
			// We will create the models based on all migrations

            return app.models.execute('SHOW server_version')
                .then(function(versions) {
                    if(versions.length) {
                        var serverVersion = parseInt(versions[0].server_version.split('.').join(''));

                        if(serverVersion < 940) {
                            throw new Error('Your PostgreSQL server version is `' + versions[0].server_version + '` but Node on Fire requires at least 9.4.0. Please upgrade your PostgreSQL server or downgrade your Node on Fire version. The former is advised.');
                        }
                    }
                })
                .then(function() {
                    return models.setup(null);
                })
				.then(function() {
					return migrations.setup(app.container.numberOfApps() > 1 ? path.join(basePath, '.fire', 'migrations', app.name) : path.join(basePath, '.fire', 'migrations'));
				})
				.then(function() {
					if(migrations._.length === 0) {
						console.log('Warning: there are 0 migration files. Did you run `fire build`? Continuing anyway...');
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
                .finally(function() {
                    return newApp.stop();
                });
        }
    });
}
BuildSystem.prototype.stages = ['build', 'release'];
