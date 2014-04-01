exports = module.exports = User;

function User(models) {
	this.name = [this.String, this.Required];
	this.password = [this.String];
	this.email = [this.String];
	this.value = [this.Integer, this.Default(123)];
}
