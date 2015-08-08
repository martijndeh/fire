exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('City', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required]
	});
	this.models.createModel('Schema', {
		id: [this.UUID, this.CanUpdate(false)],
		version: [this.Integer],
		app: [this.String],
		checksum: [this.String],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('ClockTaskResult', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('TriggerResult', {
		id: [this.UUID, this.CanUpdate(false)],
		triggerName: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')],
		subject: [this.UUIDType, this.Required]
	});
	this.models.createModel('Test', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		sessions: [this.HasMany(this.models.TestSession)],
		variants: [this.HasMany(this.models.TestVariant)]
	});
	this.models.createModel('TestParticipant', {
		id: [this.UUID, this.CanUpdate(false)],
		sessions: [this.HasMany(this.models.TestSession)]
	});
	this.models.createModel('TestSession', {
		id: [this.UUID, this.CanUpdate(false)],
		test: [this.BelongsTo(this.models.Test), this.Required],
		participant: [this.BelongsTo(this.models.TestParticipant)],
		variant: [this.String, this.Required],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('TestVariant', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String, this.Required],
		numberOfParticipants: [this.Integer, this.Required],
		test: [this.BelongsTo(this.models.Test), this.Required]
	});
	this.models._sql('06392ab8acb7ae51e88aa9d8394adae3', [
		'CREATE OR REPLACE FUNCTION publishCity() RETURNS trigger AS $$',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'		PERFORM pg_notify(\'City\', json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text);',
		'		RETURN NEW;',
		'	ELSE',
		'		PERFORM pg_notify(\'City\', json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text);',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;',
		'',
		'CREATE TRIGGER cities_notify_update AFTER UPDATE ON cities FOR EACH ROW EXECUTE PROCEDURE publishCity();',
		'CREATE TRIGGER cities_notify_insert AFTER INSERT ON cities FOR EACH ROW EXECUTE PROCEDURE publishCity();',
		'CREATE TRIGGER cities_notify_delete AFTER DELETE ON cities FOR EACH ROW EXECUTE PROCEDURE publishCity();'
	].join('\n'));

};

Migration.prototype.down = function() {
	this.models.destroyModel('City');
	this.models.destroyModel('Schema');
	this.models.destroyModel('ClockTaskResult');
	this.models.destroyModel('TriggerResult');
	this.models.destroyModel('Test');
	this.models.destroyModel('TestParticipant');
	this.models.destroyModel('TestSession');
	this.models.destroyModel('TestVariant');
	this.models._sql('06392ab8acb7ae51e88aa9d8394adae3', [
		'DROP TRIGGER cities_notify_update ON cities;',
		'DROP TRIGGER cities_notify_insert ON cities;',
		'DROP TRIGGER cities_notify_delete ON cities;'
	].join('\n'));

};
