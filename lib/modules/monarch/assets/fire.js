{{#controllers}}
app.service('Fire{{name}}', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    this.models = FireModels;

    {{#routes}}
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
    {{/routes}}
}]);
{{/controllers}}
