var path = require('path');

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        clean: {
            docs: ['docs/']
        },
        jsdoc: {
            dist: {
                src: ['lib/app.js'],
                options: {
                    destination: path.join(__dirname, 'docs'),
                    template: path.join(__dirname, 'docs-template'),
                    configure: path.join(__dirname, 'jsdoc.json')
                }
            }
        }
    });

    grunt.registerTask('docs', ['clean', 'jsdoc']);

    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-clean');
};
