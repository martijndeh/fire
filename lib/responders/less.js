exports = module.exports = LessResponder;

var Q = require('q');
var less = require('less');
var path = require('path');
var config = require('./../config');
var fs = require('fs');

function LessResponder() {
	
}

LessResponder.prototype.parseConnection = function(connection) {	
	var defer = Q.defer();

	var filePath = path.join(config.basePath, 'private', connection.request.url);
	if(path.extname(filePath) == '.css') {
		filePath = filePath.substring(0, filePath.length - 4) + '.less';

		less.render(fs.readFileSync(filePath).toString(), function(error, css) {
			if(error) {
				defer.reject();
			}
			else {
				defer.resolve(css);
			}
		})
	}
	else {
		//is this too dangerous?
		defer.reject();
	}

	return defer.promise;
}