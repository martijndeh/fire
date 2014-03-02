exports = module.exports = View;

var Q = require('q');

function View(filePath, render) {
	this.filePath = filePath;
	this._render = render;
}

View.prototype.render = function(response) {
	//todo: caller should be the controller, especially if the render method is inside the controller
	return Q(this._render.call(null, this.filePath, response));
}
