exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User', {
		id: [this.UUID, this.CanUpdate(false)],
		passwordSalt: [this.String, this.Private, this.Default(function noop() {}, 'password'), this.CanUpdate(false)],
		password: [this.String, this.Required, this.Private, this.Hash(function noop() {})],
		passwordReset: [this.HasOne(this.models.UserResetPassword)],
		accessToken: [this.String, this.Default(function noop() {}), this.CanUpdate(false)],
		email: [this.String, this.Authenticate],
		name: [this.String, this.Required],
		avatarUrl: [this.String, this.Required, this.CanUpdate(false)],
		messages: [this.HasMany(this.models.Message)],
		triggerResult: [this.Where('NOT EXISTS (SELECT * FROM trigger_results WHERE trigger_results.trigger_name = $1 AND trigger_results.subject = users.id)')],
		testParticipant: [this.HasOne(this.models.TestParticipant)]
	});
	this.models.createModel('Message', {
		id: [this.UUID, this.CanUpdate(false)],
		user: [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch(['name', 'avatarUrl'])],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')],
		text: [this.String, this.Required]
	});
	this.models.createModel('UserResetPassword', {
		id: [this.UUID, this.CanUpdate(false)],
		authenticator: [this.BelongsTo(this.models.User), this.Required],
		token: [this.String, this.Default(function noop() {}), this.Required]
	});
	this.models.createModel('UserLoginToken', {
		id: [this.UUID, this.CanUpdate(false)],
		authenticator: [this.BelongsTo(this.models.User), this.Required],
		token: [this.String, this.Unique, this.Default(function noop() {}), this.Required, this.CanUpdate(false)],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP'), this.CanUpdate(false)]
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
		sessions: [this.HasMany(this.models.TestSession)],
		authenticator: [this.BelongsTo(this.models.User), this.Optional]
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

};

Migration.prototype.down = function() {
	this.models.destroyModel('User');
	this.models.destroyModel('Message');
	this.models.destroyModel('UserResetPassword');
	this.models.destroyModel('UserLoginToken');
	this.models.destroyModel('Schema');
	this.models.destroyModel('ClockTaskResult');
	this.models.destroyModel('TriggerResult');
	this.models.destroyModel('Test');
	this.models.destroyModel('TestParticipant');
	this.models.destroyModel('TestSession');
	this.models.destroyModel('TestVariant');

};
