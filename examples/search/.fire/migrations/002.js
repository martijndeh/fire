exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.City.addProperties({
		_search: [this.Search]
	});
	this.models._sql('1a50dc0224cf3046ddc271dbd91c5924', [
		'CREATE TRIGGER cities_update_search BEFORE INSERT OR UPDATE ON cities FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(_search, \'pg_catalog.english\', name)'
	].join('\n'));

};

Migration.prototype.down = function() {
	this.models.City.removeProperties(['_search']);
	this.models._sql('1a50dc0224cf3046ddc271dbd91c5924', [
		'DROP TRIGGER cities_update_search ON cities'
	].join('\n'));

};
