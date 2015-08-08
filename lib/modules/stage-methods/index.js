// TODO: Configure ES6 in .jshintrc?

/* global Set */
'use strict';

var debug = require('debug')('fire:stage-methods');

exports = module.exports = StageMethods;

var stages = ['build', 'release', 'run'];

/**
 * This module is responsible for the management of run build and release methods invoked in the stages.
 *
 * For example, you can set a function to be executed in the build stage:
 * ```
 * app.build(function test() {
 * 	// Do some work.
 * });
 * ```
 * This test method gets executed when you `fire build` or you can invoke it directly by calling `fire build:test`.
 *
 * If you want to create tasks which do not run in the build stage automatically, see the {@link Tasks} module.
 *
 * You can also create functions to be executed in the release and the run stage:
 * ```
 * app.release(function check() {
 * 	// Do your thing.
 * });
 * ```
 *
 * Or for the run:
 * ```
 * app.run(function() {
 * 	// Run called.
 * });
 * ```
 * Please note that run is invoked in every process. To see which process is being run, you can check the argv dependency:
 * ```
 * app.run(function(argv) {
 * 	if(argv.web) {
 * 		// This is the web process.
 * 	}
 * });
 * ```
 *
 * @constructor
 */
function StageMethods(injector, $q) {
	var _stages = {};
	stages.forEach(function(stageName) {
		_stages[stageName] = [];
	});

	var _disables = new Set();

	var _addMethod = function(stage, stageMethod) {
		_stages[stage].push(stageMethod);
	};

	this.addMethod = function(stage, stageMethod) {
		return _addMethod(stage, stageMethod);
	};

	var _executeMethods = function(stage, targetSubcommand, parameter) {
		var result = $q.when(true);
		var privateMap = {
			stage: stage,
			parameter: parameter
		};

		(_stages[stage] || []).forEach(function(stageMethod) {
			var command = [stage, stageMethod.name].join(':');
			if(!_disables.has(command) && (!targetSubcommand || targetSubcommand == stageMethod.name)) {
				result = result.then(function() {
					debug('Executing ' + command);

					console.log('*** ' + command);

					return injector.call(stageMethod, privateMap);
				});
			}
		});

		return result;
	};

	stages.forEach(function(stageName) {
		this[stageName] = function(subcommand, parameter) {
			debug('Execute stage ' + stageName);

			return _executeMethods(stageName, subcommand, parameter);
		};
	}, this);

	this.enable = function(command) {
		_disables.delete(command);
	};

	this.disable = function(command) {
		_disables.add(command);
	};

	this.exports = function() {
		var _ = {};
		stages.forEach(function(stageName) {
			_[stageName] = function(stageMethod) {
				return _addMethod(stageName, stageMethod);
			};
		});
		return _;
	};
}
StageMethods.prototype.stages = stages;
