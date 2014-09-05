'use strict';

exports = module.exports = SEO;

var debug = require('debug')('fire:seo');
var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var path = require('path');

/**
 * The SEO module. This module makes an app crawlable as described in Google's Making AJAX Applications Crawlable https://developers.google.com/webmasters/ajax-crawling/ by making your content available in the HTML.
 *
 * This module is currently not taking any snapshots, instead, it compiles JavaScript with Phantom.js at runtime. This is not the best idea in a production environment and a snapshot-based approach is on the roadmap.
 *
 * @access private
 *
 * @param {App} app The app.
 * @constructor
 * @memberof SEO
 */
function SEO(app) {
    this.app = app;
}

/**
 * The setup method invoked by the app.
 *
 * Creates an express middleware and checks in every request if a _escaped_fragment_ is set in the query. If so, it renders a page with PhantomJS and sends back the result.
 */
SEO.prototype.setup = function() {
    // TODO: Store these in a _snapshots directory.

    var self = this;
    this.app.express.use(function(request, response, next) {
        if(request.query._escaped_fragment_) {
            var url = request.query._escaped_fragment_;

            // TODO: This doesn't seem especially correct. Can we use url module from node?
            var address = self.app.server.address();
            var websitePath = 'http://' + address.address + ':' + address.port + url;

            debug(websitePath);

            childProcess.execFile(phantomjs.path, [path.join(__dirname, 'phantom.js'), websitePath], function(error, data) {
                // TODO: When do we get an error? Also in case of 404? In any case, we need to be copy the status code from the original request.
                if(error) {
                    response.send(500, error);
                }
                else {
                    // TODO: We need to see if we receive a 404 etc.
                    response.send(200, data);
                }
            });
        }
        else {
            next();
        }
    });
};
