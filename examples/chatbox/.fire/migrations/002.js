exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.Message.changeProperties({
		user: [this.BelongsTo(this.models.User), this.AutoFetch(['name', 'avatarUrl'])]
	});

};

Migration.prototype.down = function() {
	this.models.Message.changeProperties({
		user: [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch(['name', 'avatarUrl'])]
	});

};
