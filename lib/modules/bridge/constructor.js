'use strict';

exports = module.exports = Constructor;

/**
 * Holds the information the angular proxy receive from any of the angular methods, like app.directive(...).
 *
 * The information is used in the generators to render the client-side library.
 *
 * @access private
 *
 * @param {String} type The angular method name.
 * @memberof Bridge
 * @constructor
 */
function Constructor(type) {
	this.type = type;
	this.arguments = [];
}
