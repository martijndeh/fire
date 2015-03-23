var fire = require('fire');
var app = fire.app('test');

app.model(function User() {
	this.email = [this.String, this.Required, this.Authenticate];
});
