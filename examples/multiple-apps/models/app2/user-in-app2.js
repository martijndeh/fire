var app = require('fire')('nodeonfire.org');

app.model(function UserInApp2() {
	this.name = [this.String, this.Required];
});
