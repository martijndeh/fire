exports = module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-build-html');

	grunt.initConfig({
		less: {
			production: {
				options: {
					compress: true
				},
				files: {
					'styles/default.min.css': 'styles/default.less'
				}
			}
		},

		buildHtml: {
			index: {
				options: {
					templates: './templates/*.html'
				},
				expand: false,
				cwd: './',
				src: 'site/index.html',
				dest: 'index.html',
				ext: '.html'
			},
			examples: {
				options: {
					templates: './templates/*.html'
				},
				expand: false,
				cwd: './',
				src: 'site/examples.html',
				dest: 'examples.html',
				ext: '.html'
			},
			'getting-started': {
				options: {
					templates: './templates/*.html'
				},
				expand: false,
				cwd: './',
				src: 'site/getting-started.html',
				dest: 'getting-started.html',
				ext: '.html'
			},
			'docs-layout': {
				options: {
					templates: './templates/*.html'
				},
				expand: false,
				cwd: './',
				src: 'site/docs-layout.html',
				dest: '_template/tmpl/layout.tmpl',
				ext: '.html'
			}
		}
	});
};
