var fire = require('fire');
var app = fire.app('nodeonfire.org');

app.model(function UserInApp1() {
	this.name = [this.String, this.Required];
});
