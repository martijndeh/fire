/* global App */
var fire = {
	appsMap: {},
	module: function(name, options) {
		if(!this.appsMap[name]) {
			this.appsMap[name] = new App(name, options);
		}

		return this.appsMap[name];
	}
};
