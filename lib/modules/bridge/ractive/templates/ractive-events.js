/* global Ractive, $ */
Ractive.events.submit = function(node, fire) {
	$(node).on('submit', function(event) {
		event.preventDefault();

		fire({
			node: node,
			original: event
		});
	});

	return {
		teardown: function() {
			$(node).off('submit');
		}
	};
};

Ractive.events.change = function(node, fire) {
	var eventName = 'change';

	if($(node).prop('tagName') == 'INPUT' || $(node).prop('tagName') == 'TEXTAREA') {
		eventName = 'keyup';
	}

	$(node).on(eventName, function(event) {
		fire({
			node: node,
			original: event
		});
	});

	return {
		teardown: function() {
			$(node).off(eventName);
		}
	};
};
