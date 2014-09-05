'use strict';

exports = module.exports = Template;

/**
 * Holds template information.
 *
 * For more information on templates, see Templates.
 *
 * @access private
 *
 * @param {String} name    The name of the template.
 * @param {Dictionary} options Any options passed to the template rendering.
 *
 * @constructor
 */
function Template(name, options) {
	this.name = name;
	this.options = options || {};
}
