'use strict';

exports = module.exports = Route;

function Route() {
	this.path = null;
	this.verb = null;
	this.controllerConstructor = null;
	this.parseRequest = null;
	this.sendResponse = null;
}