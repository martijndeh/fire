exports = module.exports = Upgrader;

var path = require('path');
var fs = require('fs');
var Q = require('q');
var Version = require('./version');

/**
 * Internal module which keeps track of the project's current Node on Fire version and creates any migrations in case of Node on Fire upgrades.
 *
 * @constructor
 */
function Upgrader(app) {
	this.app = app;

	this.versionFilePath = path.join('.fire', app.name, 'VERSION');
	this.packageJSONFilePath = path.join(__dirname, '..', '..', '..', 'package.json');
}

Upgrader.prototype.stages = ['build', 'release', 'run'];

Upgrader.prototype._readOldVersion = function() {
	var defer = Q.defer();

	fs.readFile(this.versionFilePath, {encoding: 'utf8'}, function(error, data) {
		if(error) {
			// TODO: If the file does not exist return null.

			defer.reject(error);
		}
		else {
			defer.resolve(new Version(data));
		}
	});

	return defer.promise;
};

Upgrader.prototype._writeNewVersion = function(version) {
	var defer = Q.defer();

	fs.writeFile(this.versionFilePath, version, function(error) {
		if(error) {
			defer.reject(error);
		}
		else {
			defer.resolve(version);
		}
	});

	return defer.promise;
};

Upgrader.prototype.start = function() {
	if(this.app.isBuildStage()) {
		var packageJSON = require(this.packageJSONFilePath);
		return this._writeNewVersion(packageJSON.version);
	}
};
