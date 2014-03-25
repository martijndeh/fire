'use strict';

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

var Q = require('q');
var inflection = require('inflection');
var merge = require('merge');

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

exports.normalizeClassName = function(classType) {
    var name = classType.name;

    name = name.replace(/Controller$/, '');

    return name;
};

exports.invokeSeries = function(array, methodName) {
    var params = Array.prototype.slice.call(arguments, 2);

    return array.reduce(function(soFar, item) {
        return soFar
            .then(function() {
                return Q.when(item[methodName].apply(item, params));
            })
            .fail(function(error) {
                throw error;
            })
    }, Q.when(true));
};

exports.merge = function(one, two) {
    return merge(one, two);
};

exports.setupHooks = function(Class, hookedClasses) {
    function addHook(NewClass) {
        var classes = [];

        for(var methodName in NewClass.prototype) {
            if(methodName == 'hooks') {
                classes = classes.concat(NewClass.prototype.hooks || []);
            }
            else {
                if(NewClass.prototype[methodName]) {
                    if(Class.prototype[methodName]) {
                        // The method already exists--let's make sure they all get called
                        // Always be careful with variables in loops like this
                        (function(method) {
                            var oldMethod = Class.prototype[method];
                            var newMethod = NewClass.prototype[method];

                            Class.prototype[method] = function() {
                                var params = arguments;
                                var self = this;
                                return Q.when(newMethod.apply(this, arguments))
                                    .then(function() {
                                        return Q.when(oldMethod.apply(this, arguments));
                                    });
                            };
                        })(methodName);
                    }
                    else {
                        Class.prototype[methodName] = NewClass.prototype[methodName];
                    }
                }
            }
        }

        classes.forEach(function(ChildClass) {
            addHook(ChildClass);
        });
    }

    hookedClasses.forEach(function(NewClass) {
        addHook(NewClass);
    });
};

/*
exports.eachSeries = function(array, callback) {
    return array.reduce(function(soFar, item) {
        return soFar.then(callback(item));
    }, Q.when(true));
};
 */
