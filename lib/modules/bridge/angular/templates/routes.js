function unwrap(promise, initialValue) {
    var value = initialValue;

    promise.then(function(newValue) {
        angular.copy(newValue, value);
    });

    return value;
};

app.service('fire', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;
    this.models = FireModels;
}]);

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
{{#controllers}}
{{#paths}}
    $routeProvider.when('{{path}}', {
        templateUrl: '{{templatePath}}',
        controller: '{{name}}',
        resolve: {
        {{#tests}}
            {{name}}: ['{{name}}', function({{name}}) {
                return {{name}}.participate();
            }],
        {{/tests}}
        }
    });
{{/paths}}
{{/controllers}}
}]);
