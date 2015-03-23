var fire = require('./../../..');
var app = fire.app('test', {});

function User() {
	this.name = [this.String];
}
app.model(User);

fire.start();
