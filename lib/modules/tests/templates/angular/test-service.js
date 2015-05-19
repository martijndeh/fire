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

app.provider('TestsService', [function() {
	var _delegate = null;
	this.delegate = function(delegate) {
		_delegate = delegate;
	};

	this.$get = function() {
		return {
			participate: function(test, variant) {
				if(_delegate === null) {
					throw new Error('Please set the TestsService.delegate');
				}
				else if(typeof _delegate != 'function') {
					throw new Error('TestsService#delegate must be a function.');
				}
				else {
					_delegate(test, variant);
				}
			}
		};
	}
}]);

{{#tests}}
app.service('{{name}}', ['$q', '$http', '_StorageService', 'TestsService', function {{name}}($q, $http, _StorageService, TestsService) {
	var self = this;

	this.participate = function() {
		var variant = _StorageService.get('{{name}}');

		if(variant) {
			TestsService.participate('{{name}}', variant);
			return $q.when(variant);
		}
		else {
			var defer = $q.defer();

			$http.post('/tests/{{slug}}')
				.success(function(data) {
					variant = data.variant;

					_StorageService.set('{{name}}', variant);
					TestsService.participate('{{name}}', variant);

					defer.resolve(variant);
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
			return $q.when(variant);
		}
		else {
			var defer = $q.defer();
			$http.get('/tests/{{slug}}')
				.success(function(data) {
					variant = data.variant;

					_StorageService.set('{{name}}', variant);

					defer.resolve(variant);
				})
				.error(function() {
					defer.resolve(null);
				});
			return defer.promise;
		}
	};
}]);
{{/tests}}
