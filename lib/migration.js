'use strict';

exports = module.exports = Migration;

var debug = require('debug')('fire:migration');
var Q = require('q');
var MigrationTask = require('./migration-task');
var Model = require('./model');
var Models = require('./models');

function Migration(version, models) {
    this.version = version;
    this.models = models;
    this.tasks = [];
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
    return new MigrationTask('editModel', model, {}, function(model, params) {
        function checkPropertyIsAllowed(property) {
            return property.isAllowed();
        }

        var hasAllowedProperties = (params.addedProperties || []).some(checkPropertyIsAllowed) || (params.removedProperties || []).some(checkPropertyIsAllowed);

        if(hasAllowedProperties) {
            return model.edit(params.addedProperties, params.removedProperties);
        }
        else {
            return Q.when(true);
        }
    });
};

Migration.prototype.addProperty = function(property) {
    debug('Migration#addProperty %s.%s (%d)', property.model.getName(), property.name, this.version);

    if(!this.findTaskByName('createModel', property.model)) {

        // We want to add this to any existing task which edits the model
        var task = this.findTaskByName('editModel', property.model);

        // If not existing task exists, let's create a new one
        if(!task) {
            task = this.createEditTask(property.model);
            this.tasks.push(task);
        }

        if(!task.params.addedProperties) {
            task.params.addedProperties = [];
        }

        task.params.addedProperties.push(property);

        // TODO: If this is an association we might want to re-arrange some queries...
    }
    else {
        // There is already a create model in progress
        // No need to add an edit model task
    }
};

Migration.prototype.removeProperty = function(property) {
    debug('Migration#removeProperty %s.%s (%d)', property.model.getName(), property.name, this.version);

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
    }
};

Migration.prototype.createModel = function(model) {
    if(arguments.length == 2) {
        throw new Error('Deprecated in favor of directly accessing models.');
    }

    debug('Migration#createModel %s (%d)', model.getName(), this.version);

    /*
    // TODO: check if we have a migration task already?

    // We need to somehow set this type to create and set model
    // Name-model combination is unique?

    Create, Destroy, Generic (e.g. query findOne), Edit
    */

    if(this.findTaskByName('createModel', model)) {
        // TODO: throw error because create already exists.
        throw new Error('');
    }

    var task = new MigrationTask('createModel', model, {}, function(model, params) {
        return model.setup();
    });

    this.tasks.push(task);

    // Check if any of the existing tasks references this model
    // If so, move that task after this model
    var self = this;
    this.tasks.forEach(function(existingTask) {
        var exists = false;

        if(existingTask.name == 'editModel') {
            exists = Object.keys(existingTask.params.addedProperties).some(function(propertyName) {
                return (existingTask.params.addedProperties[propertyName].options.belongsTo && 
                        existingTask.params.addedProperties[propertyName].options.referenceName == model.getName());
            });
        }
        else if(existingTask.name == 'createModel') {
            var associations = existingTask.model.getAssociations();
            exists = Object.keys(associations).some(function(propertyName) {
                var association = associations[propertyName];

                return (association.options.belongsTo && association.options.referenceName == model.getName());
            });
        }

        if(exists) {
            self.tasks.splice(self.tasks.indexOf(existingTask), 1);
            self.tasks.push(existingTask);
        }
    });

    /*
    // Check if we have a many reference, if so, move the creation OR alteration of that model behind this model    
    var associations = model.getAssociations();
    Object.keys(associations).forEach(function(associationName) {
        var association = associations[associationName];

        console.log('Checking association: ' + association.name);

        if(association.options.belongsTo) {
            var reference = association.getReference();
            var createTask = self.findTaskByName('createModel', reference);

            if(createTask) {
                self.tasks.splice(self.tasks.indexOf(createTask), 1);
                self.tasks.push(createTask);
            }
            else {
                /*
                var editTask = self.findTaskByName('editModel', reference);
                if(editTask) {
                    self.tasks.splice(self.tasks.indexOf(editTask), 1);
                    self.tasks.push(editTask);
                }
                * /
            }
        }
    });
    */
};

Migration.prototype.destroyModel = function(model) {
    if(arguments.length == 2) {
        throw new Error('Deprecated in favor of directly accessing models.');
    }

    debug('Migration#destroyModel %s (%d)', model.getName(), this.version);

    if(this.findTaskByName('destroyModel', model)) {
        throw new Error();
    }

    var editTask = this.findTaskByName('editModel', model);
    if(editTask) {
        this.tasks.splice(this.tasks.indexOf(editTask), 1);
    }

    var task = new MigrationTask('destroyModel', model, {}, function(model, params) {
        return model.destroy();
    });

    this.tasks.push(task);

    // TODO: check if this model is references by anything, if so, throw an error if that bit isn't scheduled for destruction
    // TODO: at some point we do need a CASCADE option
};

Migration.prototype.addTask = function(self, methodName, params) {
    var defer = Q.defer();

    var task = new MigrationTask(methodName, self, {defer:defer, args:params}, function(model, params) {
        return self[methodName].apply(self, params.args)
            .then(function(result) {
                params.defer.resolve(result);
            })
            .fail(function(error) {
                params.defer.reject(error);
                throw error;
            });
    });
    this.tasks.push(task);

    return defer.promise;
};

Migration.prototype.go = function(direction) {
    debug('Migration#go %s %d', direction, this.version);

    // TODO: check if we have tasks left yet?

    this.tasks = [];
    this.models.setActiveMigration(this);

    // We'll now run through migration twice:
    //      1) We do a soft-migration so we can set any forward references.
    //      2) Then we do an actual migration. (Some optimizations are in place to do this in 1 step instead of 2.)
    var self = this;
    return Q.when(this[direction].call(this))
        .then(function() {
            if(self.tasks.length == 0) {
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
            // Now we will execute all the migration tasks
            // First, make sure every model knows migration is finished
            self.models.setActiveMigration(null);

            return self.models.beginTransaction()
                .then(function(transaction) {
                    var result = Q.when(true);

                    // So we need to make sure we are using the current transaction
                    // For now, we simply set the transaction globally

                    // Execute all the tasks
                    self.tasks.forEach(function(task) {
                        result = result.then(function() {
                            return task.execute();
                        });
                    });

                    return result
                        .then(function() {
                            return self.models.commitTransaction(transaction);
                        })
                        .fail(function(error) {
                            return self.models.rollbackTransaction(transaction)
                                .then(function() {
                                    throw error;
                                })
                        });
                });
        })
        .then(function() {
            if(direction == 'up') {
                // We migrated upwards, so we insert a schema with our version
                return self.models.Schema.createOne({version: self.version});
            }
            else {
                // We migrated downwards... so let's remove this schema
                return self.models.Schema.remove({version: self.version});
            }
        })
        .fail(function(error) {
            debug('error: %s', error);
            self.models.setActiveMigration(null);
            throw error;
        });
};

Migration.prototype.soft = function() {
    // We want to make sure forward-references work during our soft migrations as well
    this.models.setActiveMigration(this);

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
                    self.models.setActiveMigration(null);

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
