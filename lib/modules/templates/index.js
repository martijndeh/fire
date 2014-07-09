'use strict';

exports = module.exports = Templates;

var util = require('util');
var path = require('path');
var config = require('./../../helpers/config');
var Resources = require('./../../helpers/resources');
var Q = require('q');
var fs = require('fs');
var debug = require('debug')('fire:templates');

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
        app.express.use(require('less-middleware')(path.join(config.basePath, 'private'), {
            dest: path.join(config.basePath, 'public')
        }));
    }

    app.template = this.template.bind(this);
}
util.inherits(Templates, Resources);

Templates.prototype.ignoreDisabled = true;

Templates.prototype.template = function(name, contents) {
    if(contents) {
        this._templates[name] = contents;
    }
    else {
        return this._templates[name];
    }
};

Templates.prototype.setup = function(basePath) {
    debug('Loading templates `' + path.join(basePath, 'templates') + '`.');

    if(this.app.options.disabled) {
        return;
    }

    Resources.prototype.setup.call(this, path.join(basePath, 'templates'));
};

Templates.prototype.load = function(fullPath) {
    debug('Templates#load ' + fullPath);

    var defer = Q.defer();

    var templateName = fullPath.substring(config.basePath.length + 'templates'.length + 2);

    var self = this;
    this.app.express.render(fullPath, function(error, html) {
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
};
