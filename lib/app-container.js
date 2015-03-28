exports = module.exports = AppContainer;

var App = require('./app');

AppContainer.kSharedAppName = '_shared';

function AppContainer(id, stage) {
	this.id = id;
	this.stage = stage || 'run';
	this.appsMap = {};
	this._activeApp = null;
}

/**
 * Returns the number of apps in the container.
 */
AppContainer.prototype.numberOfApps = function() {
	return Object.keys(this.appsMap).length;
};

/**
 * Returns the active app name.
 */
AppContainer.prototype.getActiveAppName = function() {
	return process.env.NODE_APP;
};

/**
 * Explicitly sets the active app.
 *
 * @param {App} activeApp The app to become active.
 */
AppContainer.prototype.setActiveApp = function(activeApp) {
	this._activeApp = activeApp;
};

/**
 * Returns the active app.
 *
 * The active app is either the app specified by `NODE_APP` environment variable, or, in case there is only one app, that one app.
 */
AppContainer.prototype.getActiveApp = function() {
	if(this._activeApp) {
		return this._activeApp;
	}

	var appNames = Object.keys(this.appsMap);
	var numberOfApps = appNames.length;

	var app = null;
	if(numberOfApps == 1) {
		app = this.appsMap[appNames[0]];
	}
	else {
		var activeAppName = this.getActiveAppName();
		if(!activeAppName) {
			throw new Error('Multiple apps found in container `' + this.id + '`. Please specify which of the following apps should be run in the `NODE_APP` environment variable: ' + appNames.join(', '));
		}

		app = this.appsMap[activeAppName];
	}

	if(!app) {
		throw new Error('Could not get active app in app container `' + this.id + '`.');
	}

	return app;
};

/**
 * Creates a new app with `name`. An app can only be created once. This method throws an error if the app with `name` already exists.
 *
 * See {@link App}.
 *
 * @param {String} name The name of the app to create.
 * @param {Dictionary} settings The options to pass to the app. See {@link App} for more information.
 */
AppContainer.prototype.createApp = function(name, settings) {
	if(!name) {
		throw new Error('Cannot create `App` with no name. Please specify a name in `fire#app()`.');
	}

	if(!settings) {
		throw new Error('Cannot create `App` with no options.');
	}

	if(name == AppContainer.kSharedAppName) {
		throw new Error('Cannot create shared app directly.');
	}

	var app = this.appsMap[name];

	if(app) {
		throw new Error('Cannot create app twice. App `' + name + '` already exists.');
	}

	app = new App(name, settings, this);
	this.appsMap[name] = app;
	return app;
};

/**
 * Returns an existing app with `name`. This method throws an error if the app does not exist.
 *
 * @param {String} name The name of the app to return.
 */
AppContainer.prototype.getApp = function(name) {
	if(!name && this._activeApp) {
		return this._activeApp;
	}

	if(name == AppContainer.kSharedAppName) {
		throw new Error('Cannot retrieve shared app directly.');
	}

	var app = this.appsMap[name || process.env.NODE_APP || 'default'];
	if(!app) {
		throw new Error('App `' + this.id + '`.`' + name + '` does not exist. Did you create it by specifying an options hash in `fire#app()`?');
	}

	return app;
};

AppContainer.prototype.start = function() {
	var appNames = Object.keys(this.appsMap);
	if(appNames.length > 1) {
		var masterApp = null;
		for(var i = 0, il = appNames.length; i < il; i++) {
			var app = this.appsMap[appNames[i]];

			if(app.settings('isMaster')) {
				masterApp = app;
				break;
			}
		}

		if(!masterApp) {
			throw new Error('Please specify which app should be considered the master app. The master app is responsible for shared models and any other shared dependencies.');
		}
	}

	var activeApp = this.getActiveApp();
	return activeApp._start();
};

AppContainer.prototype.stop = function() {
	Object.keys(this.appsMap).forEach(function(appName) {
		var app = this.appsMap[appName];
		return app.stop();
	}, this);
	this.appsMap = {};
};
