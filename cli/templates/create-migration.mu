// {{migrationFilePath}}
exports = module.exports = {{migrationName}};

function {{migrationName}}() {
    //
}

{{migrationName}}.prototype.apply = function() {
{{#properties}}    this.models.{{modelName}}.addProperty('{{name}}', [this.{{type}}]);
{{/properties}}}};

{{migrationName}}.prototype.revert = function() {
{{#properties}}    this.models.{{modelName}}.removeProperty('{{name}}');
{{/properties}}}};
