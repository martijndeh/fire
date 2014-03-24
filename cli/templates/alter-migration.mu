// {{migrationFilePath}}

function {{migrationName}}() {
    //
}

{{migrationName}}.prototype.apply = function() {
{{#properties}}
    this.models.{{modelName}}.addProperty('{{name}}', [this.{{type}}]);
{{/properties}}
}

{{migrationName}}.prototype.revert = function() {
    this.models.{{modelName}}.removeProperty('{{name}}');
}
