var app = require('fire')('nodeonfire.org');

app.model(function UserInApp1() {
	this.name = [this.String, this.Required];
});
