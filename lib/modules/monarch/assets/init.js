'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('{{name}}', ['ngRoute']);

{{#methods}}
app.{{type}}({{{contents}}});
{{/methods}}
