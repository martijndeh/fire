exports = module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-less');

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
		}
	});
};
