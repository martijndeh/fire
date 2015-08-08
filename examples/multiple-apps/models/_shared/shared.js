var app = require('fire')('nodeonfire.org');

app.model(function Shared() {
	this.name = [this.String, this.Required];
});
