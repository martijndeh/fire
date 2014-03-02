exports = module.exports = Action;

var config = require('./config');
var path = require('path');



function Action(name, func, controller) {
	this.name = name;
	this.func = func;
	this.controller = controller;
	this.regexp = this._regexp(this.func);
	this.matches = null;
	this.viewPath = path.join(config.basePath, 'views', this.controller.name, this._viewName(this.name));
}

Action.prototype._viewName = function(name) {
	var matches = /^([a-z0-9]+)/.exec(name);

	if(matches) {
		if(matches['input'] != matches[1]) {
			return name.substring(matches[1].length).toLowerCase();
		}
	}

	return name;
}

Action.prototype._regexp = function(func) {
	var arguments = this._annotate(func);
	
	var exp = '^';

	this.controller.paths.forEach(function(path) {
		if(path && path.length) {
			exp += '/(' + path + ')';
		}
	});

	arguments.forEach(function(arg) {
		var location = arg.indexOf('$');

		if(location == -1) {
			exp += '/(' + arg + ')';
		}
		else {
			exp += '/([^/]+)';
		}
	})

	if(exp.length == 1) {
		exp += '/';
	}
	else {
		exp += '(?:/)?';
	}

	exp += '$';

	console.log(exp);

	return new RegExp(exp, 'gi');
}

Action.prototype._annotate = function(fn) {
    var args = [];

    fnText = fn.toString().replace(STRIP_COMMENTS, '');
    argDecl = fnText.match(FN_ARGS);
    argDecl[1].split(FN_ARG_SPLIT).forEach(function(arg){
        arg.replace(FN_ARG, function(all, underscore, name){
            args.push(name);
        });
    });

    return args;
}

Action.prototype.match = function(verb, pathName) {
	//todo: we shouldn't store matches--this instance is re-used through the server
	//todo: if verb is "ge" it will also match, please consider this
	return this.name.indexOf(verb) == 0 && (this.matches = this.regexp.exec(pathName));
}

Action.prototype.execute = function() {
	return this.func.apply(this.controller, Array.prototype.slice.call(this.matches, 1));
}
