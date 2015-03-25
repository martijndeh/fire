var fire = require('fire');
var app = fire.app('nodeonfire.org');

app.model(function Shared() {
	this.name = [this.String, this.Required];
});
