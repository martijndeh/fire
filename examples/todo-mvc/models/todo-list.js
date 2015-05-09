var fire = require('fire');
var app = fire.app('todomvc');

app.model(function TodoList(TodoItemModel, _StorageService, TodoListModel) {
	this.items = [this.HasMany(TodoItemModel), this.AutoFetch];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];

	this.getCurrentList = function() {
		if(_StorageService.get('list')) {
			return TodoListModel.findOne({id: _StorageService.get('list')});
		}
		else {
			return TodoListModel.create({}).then(function(list) {
				_StorageService.set('list', list.id);
				return list;
			});
		}
	};
});
