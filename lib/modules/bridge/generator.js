exports = module.exports = Generator;

/**
 * Holds the template file path and render options created by the generators.
 *
 * @access private
 *
 * @param {String} filePath The full path to the file.
 * @param {Dictionary} options  An options dictionary passed to the template when rendering.
 * @memberof Bridge
 * @constructor
 */
function Generator(filePath, options) {
	this.filePath = filePath;
	this.options = options || {};
}
