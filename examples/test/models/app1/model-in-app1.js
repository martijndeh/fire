var fire = require('fire');
var app = fire.app('test');

app.model(function ModelInApp1() {
	this.value = [this.Integer];
});
