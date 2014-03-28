'use strict';

exports = module.exports = Migration;

var debug = require('debug')('fire:migration');
var Q = require('q');

var __currentMigration = null;

function Migration(version, models) {
    this.version = version;
    this.models = models;
    this.actionsMap = {};
}

Migration.prototype.findAction = function(model) {
    return this.actionsMap[model.getName()];
}

Migration.prototype.getAction = function(model) {
    var action = this.findAction(model);

    if(!action) {
        action = {
            model: model,
            addedProperties: [],
            removedProperties: [],
            created: false,
            destroyed: false
        };

        this.actionsMap[model.getName()] = action;
    }

    return action;
}

Migration.prototype.addProperty = function(property) {
    debug('Migration#addProperty %s.%s (%d)', property.model.getName(), property.name, this.version);

    var action = this.getAction(property.model);
    action.addedProperties.push(property);

    if(action.removedProperties.indexOf(property) >= 0) {
        throw new Error('Adding property `' + property.name + '` but it is already scheduled for removal. This is likely not on purpose thus we are throwing an error.');
    }
}

Migration.prototype.removeProperty = function(property) {
    debug('Migration#removeProperty %s.%s (%d)', property.model.getName(), property.name, this.version);

    var action = this.getAction(property.model);
    action.removedProperties.push(property);

    if(action.addedProperties.indexOf(property) >= 0) {
        throw new Error('Removing property `' + property.name + '` but it is already scheduled for addition. This is likely not on purpose thus we are throwing an error.');
    }
}

Migration.prototype.createModel = function(model) {
    if(arguments.length == 2) {
        throw new Error('Deprecated in favor of directly accessing models.');
    }

    debug('Migration#createModel %s (%d)', model.getName(), this.version);

    var action = this.getAction(model);
    action.created = true;

    if(action.destroyed) {
        throw new Error('Model `' + model.getName() + '` is already scheduled for destruction. If you are creating a new model with the same name, please do so in a separate migration.');
    }

    // check if we have a many reference, if so, move the creation of that model behind this model
    var self = this;
    var associations = model.getAssociations();
    Object.keys(associations).forEach(function(associationName) {
        var association = associations[associationName];

        if(association.manyAssociation) {
            var model = association.getReference();
            var action = self.findAction(model);

            if(action) {
                delete self.actionsMap[model.getName()];
                self.actionsMap[model.getName()] = action;
            }
        }
    })
}

Migration.prototype.destroyModel = function(model) {
    if(arguments.length == 2) {
        throw new Error('Deprecated in favor of directly accessing models.');
    }

    debug('Migration#destroyModel %s (%d)', model.getName(), this.version);

    var action = this.getAction(model);
    action.destroyed = true;

    if(action.created) {
        throw new Error('Destroying model `' + model.getName() + '` but it is already scheduled for creation. This is likely unintentional thus we are throwing an error.');
    }

    // TODO: check if this model is references by anything, if so, throw an error if that bit isn't scheduled for destruction
    // TODO: at some point we do need a CASCADE option
}

Migration.prototype.go = function(direction) {
    debug('Migration#go %s %d', direction, this.version);

    this.actionsMap = {};
    this.models.setActiveMigration(this);

    // Now let's call the actual migration in the right direction
    var self = this;
    return Q.when(this[direction].call(this))
        .then(function() {
            self.models.setActiveMigration(null);

            var result = Q.when(true);

            // TODO: actual do all migrations
            Object.keys(self.actionsMap).forEach(function(modelName) {
                var action = self.actionsMap[modelName];

                if(action.created) {
                    result = result.then(function() {
                        return action.model.setup();
                    });
                }
                else if(action.destroyed) {
                    result = result.then(function() {
                        return action.model.destroy();
                    });
                }
                else {
                    // The only option left is alter table
                    result = result.then(function() {
                        return action.model.edit(action.addedProperties, action.removedProperties);
                    });
                }
            })

            return result;
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
            throw error;
        });
};

Migration.prototype.soft = function() {
    return Q.when(this.up());
};

Migration.prototype.addProperties = function(model, properties) {
    throw new Error('Deprecated in favor of directly accessing models.');
}

Migration.prototype.removeProperties = function(model, propertyNames) {
    throw new Error('Deprecated in favor of directly accessing models.');
}
