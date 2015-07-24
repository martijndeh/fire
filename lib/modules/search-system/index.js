var debug = require('debug')('fire:search');

exports = module.exports = SearchSystem;

function SearchSystem() {
    //
}
SearchSystem.prototype.stages = ['build', 'release', 'run'];

SearchSystem.prototype.setup = function(models) {
    models.forEach(function(model) {
        if(model.searchConfig) {
            debug('Add search to `' + model.getName() + '`.');

            model._addProperty('_search', [model.Search]);
        }
    });
};
