exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models._sql('7624db770d36e93f366a90a28b26ddb5', [
		'CREATE OR REPLACE FUNCTION publishShared() RETURNS trigger AS $$',
		'DECLARE',
		'    payload TEXT;',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'		      PERFORM pg_notify(\'Shared\', payload);',
		'        END IF;',
		'        RETURN NEW;',
		'	ELSE',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'    		PERFORM pg_notify(\'Shared\', payload);',
		'        END IF;',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;',
		'',
		'CREATE TRIGGER shareds_notify_update AFTER UPDATE ON shareds FOR EACH ROW EXECUTE PROCEDURE publishShared();',
		'CREATE TRIGGER shareds_notify_insert AFTER INSERT ON shareds FOR EACH ROW EXECUTE PROCEDURE publishShared();',
		'CREATE TRIGGER shareds_notify_delete AFTER DELETE ON shareds FOR EACH ROW EXECUTE PROCEDURE publishShared();'
	].join('\n'));
	this.models._sql('16eb2f832653d441f9c28552e394d10b', [
		'CREATE OR REPLACE FUNCTION publishUserInApp1() RETURNS trigger AS $$',
		'DECLARE',
		'    payload TEXT;',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'		      PERFORM pg_notify(\'UserInApp1\', payload);',
		'        END IF;',
		'        RETURN NEW;',
		'	ELSE',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'    		PERFORM pg_notify(\'UserInApp1\', payload);',
		'        END IF;',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;',
		'',
		'CREATE TRIGGER user_in_app1s_notify_update AFTER UPDATE ON user_in_app1s FOR EACH ROW EXECUTE PROCEDURE publishUserInApp1();',
		'CREATE TRIGGER user_in_app1s_notify_insert AFTER INSERT ON user_in_app1s FOR EACH ROW EXECUTE PROCEDURE publishUserInApp1();',
		'CREATE TRIGGER user_in_app1s_notify_delete AFTER DELETE ON user_in_app1s FOR EACH ROW EXECUTE PROCEDURE publishUserInApp1();'
	].join('\n'));

};

Migration.prototype.down = function() {
	this.models._sql('7624db770d36e93f366a90a28b26ddb5', [
		'DROP TRIGGER shareds_notify_update ON shareds;',
		'DROP TRIGGER shareds_notify_insert ON shareds;',
		'DROP TRIGGER shareds_notify_delete ON shareds;'
	].join('\n'));
	this.models._sql('16eb2f832653d441f9c28552e394d10b', [
		'DROP TRIGGER user_in_app1s_notify_update ON user_in_app1s;',
		'DROP TRIGGER user_in_app1s_notify_insert ON user_in_app1s;',
		'DROP TRIGGER user_in_app1s_notify_delete ON user_in_app1s;'
	].join('\n'));

};
