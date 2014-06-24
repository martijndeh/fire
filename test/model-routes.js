var fire = require('..');
var request = require('supertest');
var Q = require('q');
var assert = require('assert');
var crypto = require('crypto');

describe('model routes', function() {
	var app = null;
	var server = null;
	var createModels = null;

	beforeEach(function(done) {
		app = fire.app();

		if(createModels) {
			createModels();
		}

		app.run()
			.then(function() {
				var result = Q.when(true);

				app.models.forEach(function(model) {
					result = result.then(function() {
						return model.setup();
					});
				});

				return result;
			})
			.then(function() {
				done();
			})
			.done();
	});

	afterEach(function(done) {
		var result = Q.when(true);

        app.models.forEach(function(model) {
            result = result.then(function() {
                return model.exists().then(function(exists) {
                    if(exists) {
                        return model.forceDestroy();
                    }
                    else {
                        return Q.when(true);
                    }
                });
            });
        });

        result
	        .then(function() {
	        	app.stop();
	        })
	        .done();
	});

	describe('authentication session', function() {
		var agent = null;

		before(function() {
			createModels = function() {
				function Action() {
					this.type = [this.String];
					this.user = [this.BelongsTo(this.models.User), this.Required];
				}
				fire.model(Action);

				Action.prototype.toJSON = function() {
					return {
						id: this.id,
						type: this.type
					};
				};

				function User() {
					this.name 		= [this.String, this.Authenticate];
					this.actions 	= [this.HasMany(this.models.Action), this.AutoFetch, this.Virtual];
				}
				fire.model(User);

				User.prototype.toJSON = function() {
					return {
						id: this.id,
						name: this.name,
						actions: this.actions
					};
				};
			};
		});

		beforeEach(function() {
			agent = request.agent(app.express);
		});

		it('can register', function(done) {
			agent.post('/api/v1/users')
				.send({
					name: 'Martijn',
					password: 'test'
				})
				.expect(200, function(error, response) {
					console.dir(response);
					
					assert.equal(response.body.id, 1);
					assert.equal(response.body.name, 'Martijn');

					done();
				});
		});

		it('can register & authorize', function(done) {
			agent.post('/api/v1/users')
				.send({
					name: 'Martijn',
					password: 'test'
				})
				.expect(200, function(error, response) {
					agent.post('/api/v1/authorize')
						.send({
							name: 'Martijn',
							password: 'test'
						})
						.expect(200, function(error, response) {
							assert.equal(response.body.id, 1);
							assert.equal(response.body.name, 'Martijn');

							done();
						});
				});
		});

		describe('authorize', function() {
			beforeEach(function(done) {
				agent.post('/api/v1/users')
					.send({
						name: 'Martijn',
						password: 'test'
					})
					.expect(200, function(error, response) {
						done();
					});
			});

			//
		});
	});

	describe('basic routes', function() {
		before(function() {
			createModels = function() {
				function Model() {
					this.name = [this.String];
					this.value = [this.Integer];
				}
				fire.model(Model);

				Model.prototype.toJSON = function() {
					return {
						id: this.id,
						name: this.name,
						value: this.value
					};
				}

				//app.models.internals['Model'] = Model;
			};
		})

		it('can create model', function(done) {
			request(app.express)
				.post('/api/v1/models')
				.send({
					name: 'Martijn'
				})
				.expect(200, function(error, response) {
					assert.equal(error, null);
					assert.equal(response.body.id, 1);
					assert.equal(response.body.name, 'Martijn');
					assert.equal(Object.keys(response.body).length, 3);

					done();
				})
		});

		describe('create multiple models', function() {
			function createModel(map) {
				var defer = Q.defer();

				request(app.express)
					.post('/api/v1/models')
					.send(map)
					.expect(200, function(error, response) {
						if(error) {
							defer.reject(error);
						}
						else {
							defer.resolve(response.body);
						}
					});

				return defer.promise;
			}

			beforeEach(function(done) {
				Q.all([
					createModel({
						name: 'Martijn 1',
						value: 1
					}),
					createModel({
						name: 'Martijn 2',
						value: 2
					}),
					createModel({
						name: 'Martijn 3',
						value: 2
					})
				]).then(function() {
					done();
				});
			});

			it('can get 1 model', function(done) {
				request(app.express)
					.get('/api/v1/models/2')
					.expect(200, function(error, response) {
						assert.equal(error, null);
						assert.equal(response.body.id, 2);
						assert.equal(response.body.name, 'Martijn 2');
						assert.equal(response.body.value, 2);

						done();
					});
			});

			it('can get an array of 1 model', function(done) {
				request(app.express)
					.get('/api/v1/models?value=1')
					.expect(200, function(error, response) {
						assert.equal(error, null);

						var models = response.body;

						assert.equal(models.length, 1);
						assert.equal(models[0].id, 1);
						assert.equal(models[0].name, 'Martijn 1');
						assert.equal(models[0].value, 1);

						done();
					});
			});

			it('can get an array of multiple models', function(done) {
				request(app.express)
					.get('/api/v1/models?value=2')
					.expect(200, function(error, response) {
						assert.equal(error, null);

						var models = response.body;

						assert.equal(models.length, 2);
						assert.equal(models[0].id, 2);
						assert.equal(models[0].name, 'Martijn 2');
						assert.equal(models[0].value, 2);

						assert.equal(models[1].id, 3);
						assert.equal(models[1].name, 'Martijn 3');
						assert.equal(models[1].value, 2);

						done();
					});
			});

			it('can update 1 model', function(done) {
				request(app.express)
					.put('/api/v1/models/3')
					.send({
						name: 'Martijn (Updated)'
					})
					.expect(200, function(error, response) {
						assert.equal(error, null);
						assert.equal(response.body.id, 3);
						assert.equal(response.body.name, 'Martijn (Updated)');
						assert.equal(response.body.value, 2);

						done();
					});
			});

			it('cannot update all models', function(done) {
				request(app.express)
					.put('/api/v1/models')
					.send({
						name: 'Oopsie'
					})
					.expect(404, function(error, response) {
						done();
					});
			});
		});
	});
});