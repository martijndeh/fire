'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('{{name}}', []);

{{#methods}}
app.{{type}}({{{contents}}});
{{/methods}}
