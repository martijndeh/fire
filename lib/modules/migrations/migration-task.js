exports = module.exports = MigrationTask;

/**
 * A migration consists of several migration tasks. A migration task is, for example, creating a model or editing a model.
 *
 * Migration tasks store information to persist models to the database.
 *
 * @access private
 *
 * @param {String} name   The name of the migration task.
 * @param {Model} model  The model associated to the task. Passed to method.
 * @param {Dictionary} params Task-specific parameters passed to method when executed.
 * @param {Function(model, params)} method The function to invoke once the task is executed.
 * @constructor
 */
function MigrationTask(name, model, params, method) {
	this.name = name;
	this.model = model;
	this.params = params || {};
	this.method = method;
}

/**
 * Executes the migration task's method with model and params as arguments.
 *
 * @return {Mixed}
 */
MigrationTask.prototype.execute = function() {
	return this.method.apply(this, [this.model, this.params]);
};
