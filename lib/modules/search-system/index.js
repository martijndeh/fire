var debug = require('debug')('fire:search');

exports = module.exports = SearchSystem;

/**
 * The search system module implements Model#search to allow you to do a full text search on your models.
 *
 * To configure a model to be searchable, you need to create a search config.
 * ```
 * Recipe.prototype.searchConfig = function() {
 * 	return {
 * 		lang: 'english',
 * 		parser: function(searchText) {
 * 			return searchText.split(' ').join(' & ');
 * 		},
 * 		properties: ['title', 'description']
 * 	};
 * };
 * ```
 * The search config method should return an object with the following keys:
 *
 * `properties`: an array of property names as strings. Which properties to search through when searching. Required.
 * `lang`: a string which is the language config passed to Postgres. Default value is `english`.
 * `parser`: a function which takes one argument, the search text, and transforms it to a Postgres search query.
 *
 * @constructor
 */
function SearchSystem() {
    //
}
SearchSystem.prototype.stages = ['build', 'release', 'run'];

SearchSystem.prototype.setup = function(models) {
    return this.migrate(models);
};

SearchSystem.prototype.migrate = function(models) {
    debug('SearchSystem#setup');

    models.forEach(function(model) {
        if(model.searchConfig) {
            debug('Add search to `' + model.getName() + '`.');

            var tableName = model.getTable().name;
            var searchConfig = model.searchConfig();
            var columnNames = searchConfig.properties.map(function(propertyName) {
                return model.getProperty(propertyName).columnName;
            });

            model._addProperty('_search', [model.Search]);
            models.sql(
                'CREATE TRIGGER ' + tableName + '_update_search BEFORE INSERT OR UPDATE ON ' + tableName + ' FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(_search, \'pg_catalog.' + (searchConfig.lang || 'english') + '\', ' + columnNames.join(', ') + ')',
                'DROP TRIGGER ' + tableName + '_update_search ON ' + tableName
            );
        }
    });
};
