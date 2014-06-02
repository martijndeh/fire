exports = module.exports = User;

var fire = require('./../../../');

function User() {
	this.name = [this.String, this.Required];
	this.password = [this.String];
	this.email = [this.String];
	this.value = [this.Integer, this.Default(123)];
}
fire.model(User);