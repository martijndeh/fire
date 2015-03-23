exports = module.exports = Migration;

function Migration() {
	//
}

Migration.prototype.up = function() {
	this.models.createModel('User1', {
		id: [this.UUID, this.CanUpdate(false)],
		name: [this.String]
	});
	this.models.createModel('Shared', {
		id: [this.UUID, this.CanUpdate(false)],
		value: [this.Integer]
	});
	this.models.createModel('User', {
		id: [this.UUID, this.CanUpdate(false)],
		email: [this.String, this.Required, this.Authenticate],
		passwordSalt: [this.String, this.Private, this.Default(function () {
						var defer = Q.defer();
						crypto.randomBytes(128, function(error, buffer) {
							if(error) {
								defer.reject(error);
							}
							else {
								defer.resolve(buffer.toString('hex'));
							}
						});
						return defer.promise;
					}, 'password'), this.CanUpdate(false)],
		password: [this.String, this.Required, this.Private, this.Hash(function (password, passwordSalt) {
							if(password) {
								var hash = crypto.createHash('sha512');
								hash.update(password);

								if(passwordSalt) {
									hash.update(passwordSalt);
								}

								return hash.digest('hex');
							}
							else {
								throw new Error('No password provided');
							}
						})],
		accessToken: [this.String, this.Default(function () {
						var defer = Q.defer();
						crypto.randomBytes(128, function(error, buffer) {
							if(error) {
								defer.reject(error);
							}
							else {
								defer.resolve(buffer.toString('hex'));
							}
						});
						return defer.promise;
					}), this.CanUpdate(false)],
		passwordReset: [this.HasOne(this.models.UserResetPassword)],
		triggerResult: [this.Where('NOT EXISTS (SELECT * FROM trigger_results WHERE trigger_results.trigger_name = $1 AND trigger_results.subject = users.id)')]
	});
	this.models.createModel('ModelInApp1', {
		id: [this.UUID, this.CanUpdate(false)],
		value: [this.Integer]
	});
	this.models.createModel('Schema', {
		id: [this.UUID, this.CanUpdate(false)],
		version: [this.Integer],
		app: [this.String],
		checksum: [this.String],
		createdAt: [this.DateTime, this.Default('CURRENT_TIMESTAMP')]
	});
	this.models.createModel('UserResetPassword', {
		id: [this.UUID, this.CanUpdate(false)],
		authenticator: [this.BelongsTo(this.models.User), this.Required],
		token: [this.String, this.Default(function () {
						var defer = Q.defer();
						crypto.randomBytes(128, function(error, buffer) {
							if(error) {
								defer.reject(error);
							}
							else {
								defer.resolve(buffer.toString('hex'));
							}
						});
						return defer.promise;
					}), this.Required]
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

};

Migration.prototype.down = function() {
	this.models.destroyModel('User1');
	this.models.destroyModel('Shared');
	this.models.destroyModel('User');
	this.models.destroyModel('ModelInApp1');
	this.models.destroyModel('Schema');
	this.models.destroyModel('UserResetPassword');
	this.models.destroyModel('ClockTaskResult');
	this.models.destroyModel('TriggerResult');

};
