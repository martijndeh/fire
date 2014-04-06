exports = module.exports = Route;

function Route(path, viewPath, caller, method, verb, filter, matches) {
	this.caller = caller;
	this.method = method;
	this.path = path;
	this.viewPath = viewPath;
	this.verb = this._transformVerb(verb);
	this.filter = filter || [];
	this.matches = matches;
}

Route.prototype._transformVerb = function(verb) {
	var transformMap = {
		'create': 'post',
		'update': 'put'
	};

	return transformMap[verb] || verb;
}

Route.prototype.acceptHeaders = function(headers) {
	for(var header in this.filter) {
		var value = this.filter[header];

		if(!headers[header].match(value)) {
			return false;
		}
	}

	return true;
}

Route.prototype.match = function(verb, pathName, headers) {
	if(this.verb == verb && this.path.test(pathName) && this.acceptHeaders(headers)) {
		return new Route(this.path, this.viewPath, this.caller, this.method, this.verb, this.filter, this.path.exec(pathName));
	}

	return null;
}