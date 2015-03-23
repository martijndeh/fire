var fire = require('fire');
var app = fire.app('test');

app.model(function Shared() {
	this.value = [this.Integer];
});
