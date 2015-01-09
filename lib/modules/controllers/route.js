'use strict';

exports = module.exports = Route;

/**
 * Holds route information from Router. For more information on routing, see Router.
 *
 * @access private
 *
 * @constructor
 */
function Route() {
	this.path = null;
	this.pathRegex = null;
	this.verb = null;
	this.controllerConstructor = null;
	this.action = null;
	this.methodName = null;
	this.method = null;
	this.argumentNames = null;
	this.isView = false;
	this.template = null;
	this.templatePath = null;
}
