exports = module.exports = Version;

function Version(string) {
	var parts = string.split('.');

	if(parts.length != 3) {
		throw new Error('Invalid version string `' + string + '`.');
	}

	this.major = parseInt(parts[0]);
	this.minor = parseInt(parts[1]);
	this.patch = parseInt(parts[2]);
}

/**
 * Compares two different versions.
 *
 * @returns 1 if `this` is bigger than `otherVersion`, -1 if `otherVersion` is bigger than `this`, or 0 if the two versions are equal to eachother.
 */
Version.prototype.compare = function(otherVersion) {
	if(this.major > otherVersion.major) {
		return 1;
	}
	else if(this.major < otherVersion.major) {
		return -1;
	}
	else {
		if(this.minor > otherVersion.minor) {
			return 1;
		}
		else if(this.minor < otherVersion.minor) {
			return -1;
		}
		else {
			if(this.patch > otherVersion.patch) {
				return 1;
			}
			else if(this.patch < otherVersion.patch) {
				return -1;
			}

			return 0;
		}
	}
};

/**
 * Returns a
 */
Version.prototype.toString = function() {
	return [this.major, this.minor, this.patch].join('.');
};
