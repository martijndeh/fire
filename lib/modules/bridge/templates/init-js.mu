'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('{{name}}', [{{moduleNames}}]);

{{#methods}}
app.{{type}}({{{contents}}});
{{/methods}}
