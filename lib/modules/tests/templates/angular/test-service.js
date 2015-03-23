/* global window, app */
app.service('_StorageService', [function _StorageService() {
	var storage = {};

	this.get = function(key) {
		if(typeof storage[key] != 'undefined') {
			return storage[key];
		}
		else {
			return window.localStorage.getItem(key);
		}
	};

	this.set = function(key, value) {
		try {
			window.localStorage.setItem(key, value);
		}
		catch(error) {
			storage[key] = value;
		}
	};

	this.unset = function(key) {
		if(typeof storage[key] != 'undefined') {
			delete storage[key];
		}
		else {
			window.localStorage.removeItem(key);
		}
	};
}]);

app.service('TestsService', [function() {
	this.delegate = null;
	this.participate = function(test, variant) {
		if(this.delegate === null) {
			throw new Error('Please set the TestsService.delegate');
		}
		else {
			this.delegate.participate(test, variant);
		}
	};
}]);

{{#tests}}
app.service('{{name}}', ['$q', '$http', '_StorageService', 'TestsService', function {{name}}($q, $http, _StorageService, TestsService) {
	var self = this;

	this.participate = function() {
		var variant = _StorageService.get('{{name}}');

		if(variant) {
			TestsService.participate('{{name}}', variant);
			return self;
		}
		else {
			var defer = $q.defer();

			$http.post('/tests/{{slug}}')
				.success(function(data) {
					_StorageService.set('{{name}}', data.variant);

					TestsService.participate('{{name}}', data.variant);

					defer.resolve(self);
				})
				.error(function() {
					defer.reject(new Error());
				});

			return defer.promise;
		}
	};

	this.getVariant = function() {
		var variant = _StorageService.get('{{name}}');

		if(variant) {
			return variant;
		}
		else {
			throw new Error('Not participated');
		}
	};
}]);
{{/tests}}
