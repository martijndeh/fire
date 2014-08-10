'use strict';

exports = module.exports = Migration;

var debug = require('debug')('fire:migration');
var Q = require('q');
var MigrationTask = require('./migration-task');

function Migration(version, models) {
    this.version = version;
    this.models = models;
    this.tasks = [];
    this.active = false;
}

Migration.prototype.findTaskByName = function(name, model) {
    for(var i = 0, il = this.tasks.length; i < il; i++) {
        var task = this.tasks[i];

        if(task.name == name && task.model == model) {
            return task;
        }
    }

    return null;
};

Migration.prototype.createEditTask = function(model) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    debug('Add task `' + 'editModel' + '`.');
    debug(model);

    if(!model) {
        throw new Error('Creating edit task `editModel` but no model specified.');
    }

    return new MigrationTask('editModel', model, {}, function(model, params) {
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

Migration.prototype.createModel = function(model) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(this.findTaskByName('createModel', model)) {
        // TODO: throw error because create already exists.
        throw new Error('');
    }

    var task = new MigrationTask('createModel', model, {}, function(model, params) {
        return model.setup();
    });

    // Check if any of the existing tasks references this model
    // If so, we want to insert this task infront of the existing task
    // Let's just solve this by doing a full sort again

    this.tasks.push(task);
};

Migration.prototype.destroyModel = function(model) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    if(this.findTaskByName('destroyModel', model)) {
        throw new Error('There should only be one destroy model task for model `' + model.getName() + '`.');
    }

    var removedProperties = [];

    var editTask = this.findTaskByName('editModel', model);
    if(editTask) {
        // We are removing all associations once a model gets destroyed
        // This is because we want to keep the in-memory models correct
        // But it happens before the model is destroy, so it's in an edit task
        // Let's push them over to the destroy model task so we can use them when sorting tasks
        removedProperties = editTask.params.removedProperties;

        this.tasks.splice(this.tasks.indexOf(editTask), 1);
    }

    var task = new MigrationTask('destroyModel', model, {removedProperties:removedProperties}, function(model, params) {
        return model.destroy();
    });

    this.tasks.push(task);

    // TODO: check if this model is references by anything, if so, throw an error if that bit isn't scheduled for destruction
    // TODO: at some point we do need a CASCADE option
};

Migration.prototype.addTask = function(self, methodName, params) {
    if(!this.active) {
        throw new Error('Adding task but migration is not active.');
    }

    debug('Add task `' + methodName + '`.');

    var defer = Q.defer();

    var task = new MigrationTask(methodName, null, {defer:defer, args:params}, function(model, params) {
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

Migration.prototype.sortTasks = function() {
    var tasks = [];

    var count = this.tasks.length * 3;

    var self = this;
    while(this.tasks.length) {
        var task = this.tasks.splice(0, 1)[0];

        var associations = task.model && task.model.getAssociations();

        // Now check if every association is in the tasks list already, or if it's not a belongsTo association
        if(((['createModel', 'destroyModel', 'editModel'].indexOf(task.name) >= 0) || self.tasks.every(function(otherTask) {
            // Only when all other tasks are finished
            return (['createModel', 'destroyModel', 'editModel'].indexOf(task.name) == -1);
        })) && (task.name != 'createModel' || Object.keys(associations).every(function(propertyName) {
            var property = associations[propertyName];
            if(property.options.belongsTo) {
                // Now see if we property.options.referenceName already exists in tasks
                return tasks.some(function(otherTask) {
                    return (otherTask.model.getName() == property.options.referenceName);
                });
            }

            return true;
        })) && (task.name != 'destroyModel' || (task.params.removedProperties || []).every(function(property) {
            // If there is an association, except for a belongs to, we can't execute the task yet
            if(property.isAssociation() && !property.options.belongsTo) {
                return tasks.some(function(otherTask) {
                    return (otherTask.model.getName() == property.options.referenceName);
                });
            }

            return true;
        })) && (task.name != 'editModel' || (task.params.addedProperties || []).every(function(property) {
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
        }))) {
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

            return self.models.beginTransaction()
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
                            return self.models.commitTransaction(transaction);
                        })
                        .catch(function(error) {
                            return self.models.rollbackTransaction(transaction)
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

Migration.prototype.activate = function() {
    this.active = true;
    this.models.setActiveMigration(this);
};

Migration.prototype.deactivate = function() {
    this.active = false;
    this.models.setActiveMigration(null);
};

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
                    self.deactivate();

                    // and set the forward references...
                    modelNames.forEach(function(modelName) {
                        self.models[modelName] = modelName;
                    });

                    return self.up();
                });
        })
};

Migration.prototype.addProperties = function(model, properties) {
    throw new Error('Deprecated in favor of directly accessing models.');
};

Migration.prototype.removeProperties = function(model, propertyNames) {
    throw new Error('Deprecated in favor of directly accessing models.');
};
