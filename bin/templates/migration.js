exports = module.exports = {{migrationName}};

function {{migrationName}}() {
	//
}

{{migrationName}}.prototype.up = function() {
{{#upTasks}}{{{contents}}}{{/upTasks}}
};

{{migrationName}}.prototype.down = function() {
{{#downTasks}}{{{contents}}}{{/downTasks}}
};
