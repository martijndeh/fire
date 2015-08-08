var app = require('fire')('todomvc');

app.model(function TodoList(TodoItemModel, _StorageService, TodoListModel) {
	this.items = [this.HasMany(TodoItemModel), this.AutoFetch];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];

	this.getCurrentList = function() {
		var _create = function() {
			return TodoListModel
				.create({})
				.then(function(list) {
					_StorageService.set('list', list.id);
					return list;
				});
		};

		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')})
				.then(function(list) {
					return list || _create();
				});
		}
		else {
			return _create();
		}
	};
});
