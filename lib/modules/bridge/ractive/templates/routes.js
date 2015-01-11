// View-based routes are not supported.
{{#controllers}}
{{#routes}}
{{#isView}}
console.log('Warning: not loading controller `{{name}}` at `{{path}}` because it\'s part of a view-based route. View-based routes are not supported in Ractive.');
{{/isView}}
{{/routes}}
{{/controllers}}
