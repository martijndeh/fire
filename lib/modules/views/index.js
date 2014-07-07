'use strict';

exports = module.exports = Views;

var util = require('util');
var path = require('path');
var config = require('./../../helpers/config');
var Resources = require('./../../helpers/resources');
var fs = require('fs');

function Views(app) {
    this.app = app;
    this._views = {};

    if(app.express) {
        app.express.engine('html', require('jade').__express);
        app.express.engine('jade', require('jade').__express);
        app.express.use(require('less-middleware')(path.join(config.basePath, 'private'), {
            dest: path.join(config.basePath, 'public')
        }));
    }

    var self = this;
    app.template = function(name, contents) {
        self._views[name] = contents;
    };
}
util.inherits(Views, Resources);

Views.prototype.ignoreDisabled = true;

Views.prototype.template = function(name) {
    return this._views[name];
};

Views.prototype.setup = function(basePath) {
    if(this.app.options.disabled) {
        return;
    }

    Resources.prototype.setup.call(this, path.join(basePath, 'views'));
}

Views.prototype.load = function(fullPath) {
    // Add the name of the file as view.
    //fs.readFileSync(fullPath);
    console.log(fullPath);
};
