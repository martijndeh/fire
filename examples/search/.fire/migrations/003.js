exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models._sql('7ddf011e22f601b2ed02f677d3115a94', [
		'CREATE OR REPLACE FUNCTION publishCity() RETURNS trigger AS $$',
		'DECLARE',
		'    payload TEXT;',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'		      PERFORM pg_notify(\'City\', payload);',
		'        END IF;',
		'        RETURN NEW;',
		'	ELSE',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'    		PERFORM pg_notify(\'City\', payload);',
		'        END IF;',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;'
	].join('\n'));

};

Migration.prototype.down = function() {
	//
};
