function Injector() {
	this.dependencyMap = {};

	this.register('self', function(self) {
		return self;
	});
}

Injector.prototype.register = function(dependencyName, callback) {
	this.dependencyMap[dependencyName] = callback;
};

Injector.prototype.execute = function(context, constructor, dependencyNames, privateMap) {
	var self = this;
	return constructor.apply(context, dependencyNames.map(function(dependencyName) {
		if(typeof privateMap[dependencyName] != 'undefined') {
			return privateMap[dependencyName];
		}
		else if(typeof self.dependencyMap[dependencyName] != 'undefined') {
			return self.dependencyMap[dependencyName](context);
		}
		else if(typeof window[dependencyName] != 'undefined') {
			return window[dependencyName];
		}
		else {
			throw new Error('Unknown dependency `' + dependencyName + '`.');
		}
	}));
};
