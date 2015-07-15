var angular = require('angular');
var app = angular.module('{{name}}', [{{moduleNames}}]);

{{#methods}}
app.{{type}}({{{contents}}});
{{/methods}}
