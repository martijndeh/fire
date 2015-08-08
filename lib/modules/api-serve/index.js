'use strict';

var path = require('path');

exports = module.exports = APIServe;

/**
 * The APIServe module. This module loads the generated API located at `.fire/.build/api/`.
 *
 * @access private
 *
 * @param {App} app The app.
 * @constructor
 * @memberof APIServe
 */
function APIServe() {
	this.stages = ['run'];

	/**
	 * Loads the model controllers in the run phase. This method is called when the app starts up. The model controllers are loaded in the `.fire/.build/api/` directory.
	 *
	 * @param  {String} basePath The root directory of the app.
	 */
	this.setup = function(basePath, app) {
		app.get('/api/*', function(request, response, next) {
			if(!response.headersSent) {
				response.header("Cache-Control", "no-cache, no-store, must-revalidate");
				response.header("Pragma", "no-cache");
				response.header("Expires", 0);
			}

			next();
		});

		app.requireDirSync(path.join(basePath, '.fire', '.build', 'api'));
	};
}
