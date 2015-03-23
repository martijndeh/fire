var fire = require('fire');
var app = fire.app('test');

app.model(function ModelInApp2() {
	this.value = [this.Integer];
});
