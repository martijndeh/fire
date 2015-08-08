exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models._sql('b9f203f6eda0e7329a753ba67890b461', [
		'CREATE OR REPLACE FUNCTION publishTodoItem() RETURNS trigger AS $$',
		'DECLARE',
		'    payload TEXT;',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'		      PERFORM pg_notify(\'TodoItem\', payload);',
		'        END IF;',
		'        RETURN NEW;',
		'	ELSE',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'    		PERFORM pg_notify(\'TodoItem\', payload);',
		'        END IF;',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;',
		'',
		'CREATE TRIGGER todo_items_notify_update AFTER UPDATE ON todo_items FOR EACH ROW EXECUTE PROCEDURE publishTodoItem();',
		'CREATE TRIGGER todo_items_notify_insert AFTER INSERT ON todo_items FOR EACH ROW EXECUTE PROCEDURE publishTodoItem();',
		'CREATE TRIGGER todo_items_notify_delete AFTER DELETE ON todo_items FOR EACH ROW EXECUTE PROCEDURE publishTodoItem();'
	].join('\n'));
	this.models._sql('732b6ac15db58de7b6619f9e7fc12343', [
		'CREATE OR REPLACE FUNCTION publishTodoList() RETURNS trigger AS $$',
		'DECLARE',
		'    payload TEXT;',
		'BEGIN',
		'	IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(NEW))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'		      PERFORM pg_notify(\'TodoList\', payload);',
		'        END IF;',
		'        RETURN NEW;',
		'	ELSE',
		'        SELECT INTO payload json_build_object(\'type\', TG_OP, \'row\', row_to_json(OLD))::text;',
		'        IF octet_length(payload) < 8000 THEN',
		'    		PERFORM pg_notify(\'TodoList\', payload);',
		'        END IF;',
		'		RETURN OLD;',
		'	END IF;',
		'END;',
		'$$ LANGUAGE plpgsql;',
		'',
		'CREATE TRIGGER todo_lists_notify_update AFTER UPDATE ON todo_lists FOR EACH ROW EXECUTE PROCEDURE publishTodoList();',
		'CREATE TRIGGER todo_lists_notify_insert AFTER INSERT ON todo_lists FOR EACH ROW EXECUTE PROCEDURE publishTodoList();',
		'CREATE TRIGGER todo_lists_notify_delete AFTER DELETE ON todo_lists FOR EACH ROW EXECUTE PROCEDURE publishTodoList();'
	].join('\n'));

};

Migration.prototype.down = function() {
	this.models._sql('b9f203f6eda0e7329a753ba67890b461', [
		'DROP TRIGGER todo_items_notify_update ON todo_items;',
		'DROP TRIGGER todo_items_notify_insert ON todo_items;',
		'DROP TRIGGER todo_items_notify_delete ON todo_items;'
	].join('\n'));
	this.models._sql('732b6ac15db58de7b6619f9e7fc12343', [
		'DROP TRIGGER todo_lists_notify_update ON todo_lists;',
		'DROP TRIGGER todo_lists_notify_insert ON todo_lists;',
		'DROP TRIGGER todo_lists_notify_delete ON todo_lists;'
	].join('\n'));

};
