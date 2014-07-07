{{#controllers}}
app.service('Fire{{name}}', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;
    this.models = FireModels;

    {{#routes}}
    {{^isView}}
    this.{{methodName}} = function({{argumentNames}}) {
        var defer = $q.defer();

        $http['{{verb}}']('{{transformedPath}}', {{transformedParams}})
            .success(function(result) {
                defer.resolve(result);
            })
            .error(function(error) {
                defer.reject(error);
            });

        return defer.promise;
    };
    {{/isView}}
    {{/routes}}
}]);
{{/controllers}}

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);

{{#controllers}}
{{#routes}}
    {{#isView}}
    $routeProvider.when('{{path}}', {
        templateUrl: '{{templatePath}}',
        controller: '{{name}}'
    });
    {{/isView}}
{{/routes}}
{{/controllers}}
}]);
