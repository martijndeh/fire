'use strict';

exports = module.exports = Migration;

var debug = require('debug')('fire:migration');
var Q = require('q');
var MigrationTask = require('./migration-task');

/**
 * Migration model contains several migration tasks.
 *
 * @access private
 *
 * @param {Number} version The migration's version number.
 * @param {Models} models  The current models module.
 * @constructor
 */
function Migration(version, models) {
    this.version = version;
    this.models = models;
    this.tasks = [];
    this.active = false;
}

/**
 * Finds a specific migration task with name for model.
 *
 * @param {String} name  The name of the task.
 * @param {Model} model The model associated to the task.
 */
Migration.prototype.findTaskByName = function(name, model) {
    for(var i = 0, il = this.tasks.length; i < il; i++) {
        var task = this.tasks[i];

        if(task.name == name && task.model == model) {
            return task;
        }
    }

    return null;
};

/**
 * Creates a task to edit a model.
 *
 * Editing a model alters the model's table, either adding, removing or changing columns.
 *
 * @param {Model} existingModel The model to be edited.
 */
Migration.prototype.createEditTask = function(existingModel) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    debug('Add task `' + 'editModel' + '`.');
    debug(existingModel);

    if(!existingModel) {
        throw new Error('Creating edit task `editModel` but no model specified.');
    }

    return new MigrationTask('editModel', existingModel, {}, function(model, params) {
        function checkPropertyIsAllowed(property) {
            return property.isAllowed();
        }

        var hasAllowedProperties = (params.addedProperties || []).some(checkPropertyIsAllowed) || (params.removedProperties || []).some(checkPropertyIsAllowed) || (params.changedProperties || []).some(checkPropertyIsAllowed);

        if(hasAllowedProperties) {
            return model.edit(params.addedProperties, params.removedProperties, params.changedProperties);
        }
        else {
            return Q.when(true);
        }
    });
};

/**
 * Adds a property to an existing model edit task, or creates an edit task if it does not yet exists.
 *
 * If there is a model create task, the property is ignored as a create task already creates all model's properties.
 *
 * @param {Property} property         The property to be added.
 * @param {Property} existingProperty Optionally, a property with the same name if it already exists.
 */
Migration.prototype.addProperty = function(property, existingProperty) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(!this.findTaskByName('createModel', property.model)) {
        // We want to add this to any existing task which edits the model
        var task = this.findTaskByName('editModel', property.model);

        // If not existing task exists, let's create a new one
        if(!task) {
            task = this.createEditTask(property.model);
            this.tasks.push(task);
        }

        if(!existingProperty) {
            if(!task.params.addedProperties) {
                task.params.addedProperties = [];
            }

            task.params.addedProperties.push(property);
        }
        else {
            if(existingProperty.clauses.join(' ') != property.clauses.join(' ')) {
                if(!task.params.changedProperties) {
                    task.params.changedProperties = [];
                }

                task.params.changedProperties.push(property);
            }
        }

        // TODO: If this is an association we might want to re-arrange some queries...
    }
    else {
        // There is already a create model in progress
        // No need to add an edit model task
    }
};

/**
 * Adds a remove property task to an existing edit model task, or creates an edit model task.
 *
 * If a destroy model task exists, removing the property is ignored because the model is already queued for destruction.
 *
 * @param {Property} property The property to be removed.
 */
Migration.prototype.removeProperty = function(property) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(!this.findTaskByName('destroyModel', property.model)) {
        var task = this.findTaskByName('editModel', property.model);

        if(!task) {
            task = this.createEditTask(property.model);
            this.tasks.push(task);
        }

        if(!task.params.removedProperties) {
            task.params.removedProperties = [];
        }

        task.params.removedProperties.push(property);
    }
    else {
        // There is already a destroyModel called
        debug('Removing property, but there is a destroy model task...');
    }
};

/**
 * Adds a create model task for the given model. If a create model task already exists, an error is thrown.
 *
 * @param {Model} existingModel The model to be created.
 */
Migration.prototype.createModel = function(existingModel) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(this.findTaskByName('createModel', existingModel)) {
        // TODO: throw error because create already exists.
        throw new Error('A createModel migration task already exists.');
    }

    var task = new MigrationTask('createModel', existingModel, {}, function(model) {
        return model.setup();
    });

    // Check if any of the existing tasks references this model
    // If so, we want to insert this task infront of the existing task
    // Let's just solve this by doing a full sort again

    this.tasks.push(task);
};

/**
 * Adds a destroy model task of the given model in `existingModel`.
 *
 * If an edit task exists for the model, the edit task is removed from the migration.
 *
 * This method throws an error if a destroy model task for this model already exists.
 *
 * @param {Model} existingModel The model to destroy.
 */
Migration.prototype.destroyModel = function(existingModel) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(this.findTaskByName('destroyModel', existingModel)) {
        throw new Error('There should only be one destroy model task for model `' + existingModel.getName() + '`.');
    }

    var removedProperties = [];

    var editTask = this.findTaskByName('editModel', existingModel);
    if(editTask) {
        // We are removing all associations once a model gets destroyed
        // This is because we want to keep the in-memory models correct
        // But it happens before the model is destroy, so it's in an edit task
        // Let's push them over to the destroy model task so we can use them when sorting tasks
        removedProperties = editTask.params.removedProperties;

        this.tasks.splice(this.tasks.indexOf(editTask), 1);
    }

    var task = new MigrationTask('destroyModel', existingModel, {removedProperties:removedProperties}, function(model) {
        return model.destroy();
    });

    this.tasks.push(task);

    // TODO: check if this model is references by anything, if so, throw an error if that bit isn't scheduled for destruction
    // TODO: at some point we do need a CASCADE option
};

/**
 * Adds a generic task to the migration.
 *
 * @param {Object} self           The object on which to call the method.
 * @param {String} methodName     The name of the method to call.
 * @param {Dictionary} existingParams The arguments to be passed to the method.
 * @return {Promise} This promise resolves after the method is finished.
 */
Migration.prototype.addTask = function(self, methodName, existingParams) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    debug('Add task `' + methodName + '`.');

    var defer = Q.defer();

    var task = new MigrationTask(methodName, null, {defer: defer, args: existingParams}, function(model, params) {
        return self[methodName].apply(self, params.args)
            .then(function(result) {
                params.defer.resolve(result);
            })
            .catch(function(error) {
                params.defer.reject(error);
                throw error;
            });
    });
    this.tasks.push(task);

    return defer.promise;
};

/**
 * @todo Refactor this.
 *
 * Sorts all tasks so they get executed in the correct order as some tasks are dependant on other tasks. Brute-force style.
 */
Migration.prototype.sortTasks = function() {
    var tasks = [];

    var count = this.tasks.length * 3;

    // TODO: This one is commented out now, because it isn't checking otherTask so it's effectively useless.
    function otherTasksFinished(otherTask) {
        // Only when all other tasks are finished
        return (['createModel', 'destroyModel', 'editModel'].indexOf(otherTask.name) == -1);
    }

    function editedModelBelongsToAlreadyExists(associations) {
        return function(propertyName) {
            var property = associations[propertyName];
            if(property.options.belongsTo) {
                // Now see if we property.options.referenceName already exists in tasks
                return tasks.some(function referenceTaskAlreadyExists(otherTask) {
                    return (otherTask.model.getName() == property.options.referenceName);
                });
            }

            return true;
        };
    }

    function associationAlreadyRemoved(property) {
        // If there is an association, except for a belongs to, we can't execute the task yet
        if(property.isAssociation() && !property.options.belongsTo) {
            return tasks.some(function referenceTaskAlreadyExists(otherTask) {
                return (otherTask.model.getName() == property.options.referenceName);
            });
        }

        return true;
    }

    function addedModelBelongsToAlreadyExists(property) {
        if(property.options.belongsTo) {
            // So we added a belongsTo to a model
            // If the referenced model is new, we need to make sure it's task is executed before this one
            // If the referenced model already exists, we're good

            // Now see if we property.options.referenceName already exists in tasks
            var existsInExistingTasks = tasks.some(function(otherTask) {
                return (otherTask.name == 'createModel' && (otherTask.model.getName() == property.options.referenceName));
            });

            var existsInOtherTasks = self.tasks.some(function(otherTask) {
                return (otherTask.name == 'createModel' && (otherTask.model.getName() == property.options.referenceName));
            });

            if(!existsInOtherTasks && !existsInExistingTasks) {
                return true;
            }
            else {
                return existsInExistingTasks;
            }
        }

        return true;
    }

    var self = this;
    while(this.tasks.length) {
        var task = this.tasks.splice(0, 1)[0];

        var associations = task.model && task.model.getAssociations();

        // Now check if every association is in the tasks list already, or if it's not a belongsTo association
        if(((['createModel', 'destroyModel', 'editModel'].indexOf(task.name) >= 0) || self.tasks.every(otherTasksFinished)) &&
            (task.name != 'createModel' || Object.keys(associations).every(editedModelBelongsToAlreadyExists(associations))) &&
            (task.name != 'destroyModel' || (task.params.removedProperties || []).every(associationAlreadyRemoved)) &&
            (task.name != 'editModel' || (task.params.addedProperties || []).every(addedModelBelongsToAlreadyExists))) {
            tasks.push(task);
        }
        else {
            this.tasks.push(task);
        }

        count--;

        if(count <= 0) {
            throw new Error('Could not sort migration tasks. Please try to manually sort your migration tasks and file a bug.');
        }
    }

    this.tasks = tasks;
};

/**
 * Executes the migration in the given direction.
 *
 * This method first calls Migration#up or Migration#down (depending on the migration). In these methods the migration tasks are created.
 *
 * If any new models are added, we create forward references to newly created models and call the migration in the opposite direction to revert changes. Then we call the migration-specific method again (with forward references in place). Forward references are neccesary so that we can reference `this.models.User` in any task even if it has not been created yet.
 *
 * Then we sort all the tasks based on their dependencies.
 *
 * Then we start a database transaction, and execute all the separate tasks. If an error occurs, we rollback and an error is thrown. Once all tasks are executed we commit the transaction.
 *
 * Lastly, we create a Schema instance for this migration's version number.
 *
 * @param  {up|down} direction Either "up" or "down".
 * @return {Promise}
 */
Migration.prototype.go = function(direction) {
    debug('Migration#go %s from %d', direction, this.version);

    // TODO: check if we have tasks left yet?

    this.tasks = [];
    this.activate();

    // We'll now run through migration twice:
    //      1) We do a soft-migration so we can set any forward references.
    //      2) Then we do an actual migration. (Some optimizations are in place to do this in 1 step instead of 2.)
    var self = this;
    return Q.when(this[direction].call(this))
        .then(function() {
            if(!self.tasks.length) {
                throw new Error('There are only 0 tasks in your migration. How can that be?');
            }

            // Migration tasks created: let's see if we have any pending model creations
            var modelNames = [];
            self.tasks.forEach(function(task) {
                if(task.name == 'createModel') {
                    modelNames.push(task.model.getName());
                }
            });

            // If we have at least 1 new model and we at least have 2 tasks...
            if(modelNames.length > 0 && self.tasks.length > 1) {
                debug('Migration#go creating forward-references');

                // We reverse the migration, set the model names so they can be used as forward-references
                var revert = direction == 'up' ? 'down' : 'up';

                return Q.when(self[revert].call(self))
                    .then(function() {
                        // Now we remove all tasks
                        self.tasks = [];

                        // and set the forward references...
                        modelNames.forEach(function(modelName) {
                            self.models[modelName] = modelName;
                        });

                        debug('Migration#go soft-migrating back');
                        return self[direction].call(self);
                    });
            }
            else {
                // We have no new models or no other migration tasks
                // It's safe to say we don't need forward-reference features
                // Let's just continue
                return true;
            }
        })
        .then(function() {
            debug('Migration#go sorting tasks (' + self.tasks.length + ')');

            self.sortTasks();

            // Now we will execute all the migration tasks
            // First, make sure every model knows migration is finished
            self.deactivate();

            debug('Migration#go startin transactions');

            return self.models.datastore.beginTransaction()
                .then(function(transaction) {
                    var result = Q.when(true);

                    // So we need to make sure we are using the current transaction
                    // For now, we simply set the transaction globally

                    // Execute all the tasks
                    self.tasks.forEach(function(task) {
                        result = result.then(function() {
                            debug('Migration#go executing task ' + task.name);

                            return task.execute();
                        });
                    });

                    return result
                        .then(function() {
                            return self.models.datastore.commitTransaction(transaction);
                        })
                        .catch(function(error) {
                            return self.models.datastore.rollbackTransaction(transaction)
                                .then(function() {
                                    throw error;
                                });
                        });
                });
        })
        .then(function() {
            if(direction == 'up') {
                // We migrated upwards, so we insert a schema with our version
                return self.models.Schema.create({version: self.version});
            }
            else {
                // We migrated downwards... so let's remove this schema
                return self.models.Schema.remove({version: self.version});
            }
        })
        .catch(function(error) {
            debug(error);

            self.models.setActiveMigration(null);
            throw error;
        });
};

/**
 * Let's all models know we are in migration mode.
 *
 * This sets this migration as the active migration on all models, which proxies all of their methods to this migration so we can create migration tasks for them if executed.
 */
Migration.prototype.activate = function() {
    this.active = true;

    this.models.setActiveMigration(this);
};

/**
 * This deactives the migration state on all models, see Migration#activate.
 */
Migration.prototype.deactivate = function() {
    this.active = false;

    this.models.setActiveMigration(null);
};

/**
 * Executes a migration without actually applying anything to the database.
 *
 * @return {Promise}
 */
Migration.prototype.soft = function() {
    debug('Migration#soft');

    // We want to make sure forward-references work during our soft migrations as well
    this.activate();

    var self = this;
    return Q.when(this.up())
        .then(function() {
            // Migration tasks created: let's see if we have any pending model creations
            var modelNames = [];
            self.tasks.forEach(function(task) {
                if(task.name == 'createModel') {
                    modelNames.push(task.model.getName());
                }
            });

            return Q.when(self.down())
                .then(function() {
                    // Now we remove all tasks
                    self.tasks = [];

                    // and set the forward references...
                    modelNames.forEach(function(modelName) {
                        self.models[modelName] = modelName;
                    });

                    return self.up();
                })
                .then(function() {
                    // ... and we disable the activeMigration
                    self.deactivate();
                });
        });
};
