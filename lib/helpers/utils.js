'use strict';

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

var Q = require('q');
var merge = require('merge');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('fire:utils');

exports.getMethodName = function(method, prototype) {
    var methodName;
    for(methodName in prototype) {
        var prototypeMethod = prototype[methodName];

        if(method == prototypeMethod) {
            return methodName;
        }
    }

    return null;
};

exports.ConstructWrapper = function(constructor, args) {
    function F() {
        return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
};

exports.indexOfFirstBracket = function(constructorText) {
    var fromIndex       = 0;

    // TODO: Change this.
    // One important point is that this keeps the comments in tact in the constructor body.

    while(true) {
        var firstBracket    = constructorText.indexOf('{', fromIndex);
        var comments        = [constructorText.indexOf('//', fromIndex), constructorText.indexOf('/*', fromIndex)];

        if(firstBracket == -1) {
            throw new Error('Could not find a bracket.');
        }

        if(firstBracket >= 0 && (comments[0] == -1 || comments[0] > firstBracket) && (comments[1] == -1 || comments[1] > firstBracket)) {
            return firstBracket;
        }
        else {
            var index;
            if(comments[0] >= 0 && comments[0] < firstBracket) {
                index = constructorText.indexOf('\n', comments[0]);
                if(index == -1) {
                    throw new Error('Could not find end of comment.');
                }
                else {
                    fromIndex = index;
                }
            }
            else if(comments[1] >= 0 && comments[1] < firstBracket) {
                index = constructorText.indexOf('*/', comments[1]);
                if(index == -1) {
                    throw new Error('Could not find end of comment.');
                }
                else {
                    fromIndex = index;
                }
            }
            else {
                break;
            }
        }
    }

    throw new Error('Could not find first bracket.');
};

exports.stripMethodFirstLine = function(constructor) {
    var constructorText = constructor.toString();

    var firstBracket = this.indexOfFirstBracket(constructorText);

    return constructorText.substring(firstBracket);
};

exports.getMethodArgumentNames = function(fn) {
    var args = [];

    var fnText = fn.toString().replace(STRIP_COMMENTS, '');
    var argDecl = fnText.match(FN_ARGS);

    argDecl[1].split(FN_ARG_SPLIT).forEach(function(arg){
        arg.replace(FN_ARG, function(all, underscore, name){
            args.push(name);
        });
    });

    return args;
};

exports.captureOne = function(string, regex) {
    var matches = regex.exec(string);
    if(matches && matches.length > 1) {
        return matches[1];
    }

    return null;
};

exports.ucfirst = function(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
};

exports.lcfirst = function(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
};

exports.normalizeClassName = function(classType) {
    var name = classType.name;

    name = name.replace(/Controller$/, '');

    return name;
};

exports.invokeSeries = function(array, methodName) {
    var args = new Array(arguments.length);
    for(var i = 0; i < args.length; ++i) {
        args[i] = arguments[i];
    }

    var params = Array.prototype.slice.call(args, 2);

    return array.reduce(function(soFar, item) {
        return soFar
            .then(function() {
                return Q.when(item[methodName].apply(item, params));
            });
    }, Q.when(true));
};

exports.merge = function(one, two) {
    return merge(one, two);
};

exports.zeroPad = function(number, base) {
    var length = (String(base).length - String(number).length) + 1;
    return length > 0 ? new Array(length).join('0') + number : number;
};

var _readDirSync = function(basePath, callback) {
    if(fs.existsSync(basePath)) {
        fs.readdirSync(basePath).forEach(function(resourceFileName) {
            if(resourceFileName.length && resourceFileName[0] != '_' && resourceFileName[0] != '.') {
                var fullPath = path.join(basePath, resourceFileName);
                if(fs.lstatSync(fullPath).isDirectory()) {
                    _readDirSync(fullPath, callback);
                }
                else {
                    callback(fullPath);
                }
            }
        });
    }
};
exports.readDirSync = _readDirSync;

exports.requireDirSync = function() {
    throw new Error('Please use `App#requireDirSync` instead.');
};

exports._requireDirSync = function(dirPath) {
    exports.readDirSync(dirPath, function(filePath) {
        if(path.extname(filePath) != '.js') {
            debug('Not loading file at path `' + filePath + '` because the extension is not `.js`.');
        }
        else {
            require(filePath);
        }
    });
};

/**
 * Parses the authorization header and returns an array with two values: the user name, the password.
 *
 * This function either returns null, or an array with always a length of 2.
 *
 * @param {String} authorization The basic auth value. The word "Basic " followed by a base64 encoded username and password combination concatenated by a colon character.
 */
exports.parseAuthorization = function(authorization) {
    var credentials = null;

    if(authorization && authorization.length > 6) {
        credentials = (new Buffer(authorization.substring(6), 'base64')).toString('utf8').split(':'); //jshint ignore:line

        if(!credentials.length) {
            credentials = null;
        }
        else if(credentials.length == 1) {
            credentials.push('');
        }
    }

    return credentials;
};

/*
exports.eachSeries = function(array, callback) {
    return array.reduce(function(soFar, item) {
        return soFar.then(callback(item));
    }, Q.when(true));
};
 */
