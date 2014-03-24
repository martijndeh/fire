exports = module.exports = {{modelName}};

function {{modelName}}(models) {
{{#properties}}	this.{{name}} = [this.{{type}}];
{{/properties}}}}
