var Controllers = require('./controllers');
var Controller = require('./controller');
var Models = require('./models');
var Views = require('./views');
var Workers = require('./workers');

var config = require('./config');

var path = require('path');

var express = require('express');
var debug = require('debug')('fire:http');

var Q = require('q');

var memwatch = require('memwatch');

exports = module.exports = App;

function App() {
	this.workers = new Workers();

	this.models = new Models(this.workers);
	this.views = new Views();
	this.controllers = new Controllers(this);

	this.server = express();
	this.server.engine('html', require('jade').__express);
	this.server.engine('jade', require('jade').__express);

	this.server.use(require('less-middleware')(path.join(config.basePath, 'private'), {
		dest: path.join(config.basePath, 'public')
	}));
	this.server.use(express.static(path.join(config.basePath, 'public')));
	this.server.use(require('cookie-session')({
		keys: ['Test key 2', 'Test key 1'],
		key: 'sid'
	}));
	this.server.use(require('body-parser')());

	this.server.disable('x-powered-by');
}

App.prototype.run = function() {
	var self = this;
	return Q.all([
		self.views.setup(path.join(config.basePath, 'views')),
		self.controllers.setup(path.join(config.basePath, 'controllers'), self.models),
		self.models.setup(path.join(config.basePath, 'models')),
		self.workers.setup(path.join(config.basePath, 'workers'))
	])
	.then(function setupServer() {
		var port = null;

		if(!process.env.PORT && process.env.NODE_ENV != 'test') {
			debug('PORT environment variable not set. Setting to default port 3000.');
		}
		else if(process.env.NODE_ENV == 'test') {
			//
		}
		else {
			port = (process.env.PORT || 3000);
		}

		debug('Start server on http://127.0.0.1:' + port + '/');
		return self.server.listen(port);
	})
	.fail(function(error) {
		console.log(error);
		console.log(error.stack);
		console.log('Error when starting, bleh.');
		throw error;
	});
};

App.prototype._configureConnection = function(ControllerClass, action, viewPath) {
	var fullViewPath = this.views.getFullPath(viewPath);

	var app = this;
	return function parseConnection(request, response) {
		var heapStart = new memwatch.HeapDiff();

		// Create the actual controller. We allocate a new instance per request so we won't share any data between requests.
		var controller = new ControllerClass();
		Controller.call(controller, app.models, request, response);

		// Call the -before.
		var result = false;
		if(controller.before) {
			result = controller.before();
		}
		else {
			result = true;
		}

		Q.when(result)
			.then(function() {
				// Call the action.
				return action.apply(controller, Object.keys(request.params).map(function(key) {
					return request.params[key];
				}));
			})
			.then(function(result) {
				if(fullViewPath) {
					debug('View path is for `' + viewPath + '` is `' + fullViewPath + '`.');

					response.render(fullViewPath, result);
				}
				else {
					response.json(result);
				}

				var heapDiff = heapStart.end();
				console.log('HEAP DIFF AFTER REQUEST');
				console.dir(heapDiff);
				console.dir(heapDiff.change.details);
			})
			.fail(function(error) {
				if(fullViewPath) {
					response.send(error.status || 500, error.message);
				}
				else {
					response.send(error.status || 500, {
						error: error.message
					});
				}
			})
			.done();
	};
};

App.prototype.addRoute = function(verb, url, ControllerClass, action, viewPath) {
	if(this.server[verb] && typeof this.server[verb] == 'function') {
		this.server[verb].call(this.server, url, this._configureConnection(ControllerClass, action, viewPath));
	}
	else {
		debug('Invalid verb `' + verb + '` in controller `' + ControllerClass + '`.')
	}
};