'use strict';

exports = module.exports = AccessControl;

/**
 * AccessControl manages the permissions ..
 *
 * ```
 * function User() {
 * 	this.email = [this.String];
 * 	this.password = [this.String];
 * 	this.accessControl = [this.Read(), this.Create(), this.]
 * }
 * app.model(User);
 * ```
 *
 * @constructor
 */
function AccessControl() {
	this._ = {};
}

AccessControl.prototype.setPermissionFunction = function(action, permissionFunction) {
	this._[action] = permissionFunction;
};

AccessControl.prototype.setPermissionKeyPath = function(action, permissionKeyPath) {
	this._[action] = permissionKeyPath;
};

AccessControl.prototype.canCreate = function(authenticator) {
	var functionOrKeyPath = this._.create;

	if(typeof functionOrKeyPath == 'function') {
		return !!functionOrKeyPath(authenticator);
	}

	if(functionOrKeyPath) {
		// Ah key path is pretty difficult in create.
		throw new Error('Key path-based permission is not possible in create.');
	}

	if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
		console.log('Warning: no access control declared. In development environment access control will default to open, but in production the default will be closed to prevent security issues. To remove this warning, declare access control on your models.');
		return true;
	}

	return false;
};

AccessControl.prototype.canRead = function(authenticator) {
	var functionOrKeyPath = this._.read;

	if(!functionOrKeyPath) {
		// No access control is declared. So let's fallback to true in development and false in production.

		if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
			console.log('Warning: no access control declared. In development environment access control will default to open, but in production the default will be closed to prevent security issues. To remove this warning, declare access control on your models.');
			return true;
		}

		// False in non-development mode.
		return false;
	}

	if(typeof functionOrKeyPath == 'function') {
		return !!functionOrKeyPath(authenticator);
	}

	return false;
};

AccessControl.prototype.getPermissionFunction = function(action) {
	var functionOrKeyPath = this._[action];

	if(!functionOrKeyPath) {
		// No access control is declared. So let's fallback to true in development and false in production.

		if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
			console.log('Warning: no access control declared. In development environment access control will default to open, but in production the default will be closed to prevent security issues. To remove this warning, declare access control on your models.');
			return function() { return true; };
		}

		// False in non-development mode.
		return function() { return false; };
	}

	if(typeof functionOrKeyPath != 'function') {
		// A key path is defined, so we'll allow this.

		// TODO: If it's not a function, it does not have to be a string.
		return function() { return true; };
	}

	return functionOrKeyPath;
};

AccessControl.prototype.getPermissionKeyPath = function(action) {
	var functionOrKeyPath = this._[action];

	if(typeof functionOrKeyPath != 'string') {
		return null;
	}

	return functionOrKeyPath;
};
