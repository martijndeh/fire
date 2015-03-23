'use strict';

exports = module.exports = Templates;

var path = require('path');
var config = require('./../../helpers/config');
var utils = require('./../../helpers/utils');
var Q = require('q');
var fs = require('fs');
var debug = require('debug')('fire:templates');

/**
 * The templates module loads all templates from the `/templates` directory in the app's root directory. Plain html files and jade templates are currently supported.
 *
 * To create a template, store a file in the `templates` directory in your app's root directory. You can also create inline templates on an {@link App} instance:
 * ```
 * app.template('hello-world', '<h1>Hello, world</h1>');
 * ```
 *
 * In a view route you can simply use the `hello-world` template, see {@link Controller#template} for more on view routes.
 *
 * This module also creates {@link App#template}, see {@link Templates#template}.
 *
 * Please note: templates are public.
 *
 * @param {App} app The app instance.
 *
 * @constructor
 */
function Templates(app) {
    this.app = app;
    this._templates = {};
    this._errors = {};

    app.template = this.template.bind(this);
}

Templates.prototype.stages = ['build', 'release', 'run'];

/**
 * Either gets the html of template, or sets the template's html with `html`.
 *
 * This method allows you to create inline templates instead of creating a new file in the `templates/` directory.
 *
 * Please note that a template should always be considered public. A route is automatically created to the template and there is no access restriction.
 *
 * @param  {String} path     The path of the template.
 * @param  {String} html Optionally, set the html of the template.
 * @return {String}          Returns the html of the template.
 */
Templates.prototype.template = function(templatePath, html) {
    if(html) {
        this._templates[templatePath] = html;
        return html;
    }
    else {
        return this._templates[templatePath];
    }
};

/**
 * Creates a GET route to the template in the HTTP module. See {@link Templates#setup}.
 *
 * @access private
 *
 * @param {String} templateName
 */
Templates.prototype.createTemplateRoute = function(templatePath) {
    debug('addTemplate ' + templatePath);

    var self = this;
    this.app.HTTPServer.express.get(templatePath, function(request, response) {
        var error = self._errors[templatePath];
        if(error) {
            response.status(500).send(error);
        }
        else {
            var html = self._templates[templatePath];
            if(!html) {
                response.status(404).send();
            }
            else {
                response.status(200).send(html);
            }
        }
    });
};

/**
 * For every template create via `App#template` a route is created in the HTTP module.
 *
 * @access private
 *
 * @param  {String} basePath The app's root directory.
 */
Templates.prototype.setup = function(basePath) {
    debug('Loading templates `' + path.join(basePath, 'templates') + '`.');

    if(this.app.settings('disabled')) {
        return;
    }

    if(this.app.HTTPServer.express) {
        // This is a stupid hack.
        this.app.HTTPServer.express.engine('html', function(filePath, options, callback) {
            return fs.readFile(filePath, function(error, data) {
                callback(null, data.toString('utf8'));
            });
        });
    }

    var self = this;

    // Create routes for any inline templates (as they are not in the `templates/` folder).
    Object.keys(this._templates).forEach(function(templateName) {
        self.createTemplateRoute(templateName);
    });
};
