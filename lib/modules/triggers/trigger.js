'use strict';

var Q = require('q');
var debug = require('debug')('fire:trigger');

exports = module.exports = Trigger;

function Trigger(name, moduleProperties) {
	this.name = name;

	moduleProperties.set(this);

	if(!this.timingPattern) {
		this.timingPattern = '0 0,30 * * * *';
	}
}

Trigger.prototype.findSubjects = function(whereMap, optionsMap) {
	debug('Trigger#findSubjects');

	var where = whereMap || {};
	where.triggerResult = this.name;

	return this.models.getAuthenticator().find(where, optionsMap);
};

Trigger.prototype.select = function() {
	// This needs to be overwritten by the implementor
	throw new Error('Please overwrite Trigger#select in your trigger.');
};

Trigger.prototype.storeSubject = function(subject) {
	return this.models.TriggerResult.create({
		triggerName: this.name,
		subject: subject.id
	});
};

Trigger.prototype.start = function() {
	debug('Trigger#start ', this.name);

	var self = this;
	return self.findSubjects(this.select())
		.then(function(subjects) {
			var result = Q.when(true);

			subjects.forEach(function(subject) {
				result = result.then(function() {
					return Q.when(self.run(subject))
						.then(function() {
							return self.storeSubject(subject);
						});
				});
			});

			return result;
		})
		.catch(function(error) {
			debug(error);
			throw error;
		});
};
