$(window).on('popstate', function(event) {
	var path = window.location.pathname;

	{{#controllers}}{{#routes}}{{#isView}}
	if(new RegExp('^{{pathRegex}}$', 'i').test(path)) {
		app.loadController('{{name}}', '{{templatePath}}');
		return;
	}
	{{/isView}}{{/routes}}{{/controllers}}

	// TODO: What if we have no route?
});
