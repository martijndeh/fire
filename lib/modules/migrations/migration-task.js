exports = module.exports = MigrationTask;

function MigrationTask(name, model, params, method) {
	this.name = name;
	this.model = model;
	this.params = params || {};
	this.method = method;
}

MigrationTask.prototype.execute = function() {
	return this.method.apply(this, [this.model, this.params]);
};
