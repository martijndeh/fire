'use strict';

exports = module.exports = Templates;

var path = require('path');
var config = require('./../../helpers/config');
var utils = require('./../../helpers/utils');
var Q = require('q');
var fs = require('fs');
var debug = require('debug')('fire:templates');

/**
 * The templates module loads all templates from the /templates directory. Plain html files and jade templates are currently supported.
 *
 * This module also creates App#template, see Templates#template.
 *
 * @param {App} app The app.
 */
function Templates(app) {
    this.app = app;
    this._templates = {};

    if(app.express) {
        // This is a stupid hack.
        app.express.engine('html', function(path, options, callback) {
            return fs.readFile(path, function(error, data) {
                callback(null, data.toString('utf8'));
            });
        });

        app.express.engine('jade', require('jade').__express);

        // TODO: We also have a less-middleware in static. Which one is leading?
        app.express.use(require('less-middleware')(path.join(config.basePath, 'private'), {
            dest: path.join(config.basePath, 'public')
        }));
    }

    app.template = this.template.bind(this);
}

Templates.prototype.ignoreDisabled = true;

/**
 * Either gets the html of template, or sets the template's html with `html`.
 *
 * This method allows you to create inline templates instead of creating a new file in the templates/ directory.
 *
 * @param  {String} name     The name of the template.
 * @param  {String} html Optionally, set the html of the template.
 * @return {String}          Returns the html of the template.
 */
Templates.prototype.template = function(name, html) {
    if(html) {
        this._templates[name] = html;
        return html;
    }
    else {
        return this._templates[name];
    }
};

/**
 * Loads all templates from /templates and compiles them to html.
 *
 * @param  {String} basePath The app's root directory.
 */
Templates.prototype.setup = function(basePath) {
    debug('Loading templates `' + path.join(basePath, 'templates') + '`.');

    if(this.app.options.disabled) {
        return;
    }

    var self = this;
    utils.readDirSync(path.join(basePath, 'templates'), function(filePath) {
        debug('Templates#load ' + filePath);

        var defer = Q.defer();

        var templateName = filePath.substring(config.basePath.length + 'templates'.length + 2);

        self.app.express.render(filePath, function(error, html) {
            if(error) {
                console.log(error);
                defer.reject(error);
            }
            else {
                debug('Creating template `' + templateName + '`.');

                self._templates[templateName] = html;
                defer.resolve();
            }
        });

        return defer.promise;
    });
};
