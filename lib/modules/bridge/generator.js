exports = module.exports = Generator;

/**
 * Holds the template filename and render options created by the generators.
 *
 * @access private
 *
 * @param {String} fileName The file name of the template.
 * @param {Dictionary} options  An options dictionary passed to the template when rendering.
 * @memberof Bridge
 * @constructor
 */
function Generator(fileName, options) {
	this.fileName = fileName;
	this.options = options || {};
}
