/* global describe, beforeEach, afterEach, before, it */
'use strict';

var fire = require('..');
var request = require('supertest');
var Q = require('q');
var assert = require('assert');

describe('model routes', function() {
	var app = null;
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
				// TODO: Why are we doing a timeout here?
				setTimeout(function() {
					done();
				}, 500);
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
	        	return app.stop();
	        })
	        .then(function() {
	        	done();
	        })
	        .done();
	});

	describe('authentication session', function() {
		var agent = null;

		before(function() {
			createModels = function() {
				function User() {
					this.name 		= [this.String, this.Authenticate];
					this.actions 	= [this.HasMany(this.models.Action), this.AutoFetch, this.Virtual];
					this.accessControl = [this.Create(function() { return true; })];
				}
				fire.model(User);

				User.prototype.toJSON = function() {
					return {
						id: this.id,
						name: this.name,
						actions: this.actions
					};
				};

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


			};
		});

		beforeEach(function() {
			assert.notEqual(app, null);
			assert.notEqual(app.express, null);

			agent = request.agent(app.express);
		});

		it('can register', function(done) {
			agent.post('/api/users')
				.send({
					name: 'Martijn',
					password: 'test'
				})
				.expect(200, function(error, response) {
					assert.equal(error, null);
					assert.equal(response.body.id, 1);
					assert.equal(response.body.name, 'Martijn');

					done(error);
				});
		});

		it('can register & authorize', function(done) {
			agent.post('/api/users')
				.send({
					name: 'Martijn',
					password: 'test'
				})
				.expect(200, function(error) {
					assert.equal(error, null);

					agent.post('/api/authorize')
						.send({
							name: 'Martijn',
							password: 'test'
						})
						.expect(200, function(err, response) {
							assert.equal(err, null);
							assert.equal(response.body.id, 1);
							assert.equal(response.body.name, 'Martijn');

							done(err);
						});
				});
		});

		/*
		it('cannot get user', function(done) {
			app.models.User.create({name: 'Martijn', password: 'test'})
				.then(function(user) {
					assert.notEqual(user, null);
					assert.equal(user.id, 1);

					agent.get('/api/users/' + user.id).send().expect(403, function(error, response) {
						console.dir(response.body);
					});
				});
		});
		*/

		describe('authorize', function() {
			beforeEach(function(done) {
				agent.post('/api/users')
					.send({
						name: 'Martijn',
						password: 'test'
					})
					.expect(200, function(error) {
						done(error);
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
					this.accessControl = [this.Create(function() { return true; }), this.Update(function() { return true; })];
				}
				fire.model(Model);

				Model.prototype.toJSON = function() {
					return {
						id: this.id,
						name: this.name,
						value: this.value
					};
				};

				//app.models.internals['Model'] = Model;
			};
		});

		it('can create model', function(done) {
			request(app.express)
				.post('/api/models')
				.send({
					name: 'Martijn'
				})
				.expect(200, function(error, response) {
					assert.equal(error, null);
					assert.equal(response.body.id, 1);
					assert.equal(response.body.name, 'Martijn');
					assert.equal(Object.keys(response.body).length, 3);

					done();
				});
		});

		describe('create multiple models', function() {
			function createModel(map) {
				var defer = Q.defer();

				request(app.express)
					.post('/api/models')
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
					.get('/api/models/2')
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
					.get('/api/models?value=1')
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
					.get('/api/models?value=2')
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
					.put('/api/models/3')
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
					.put('/api/models')
					.send({
						name: 'Oopsie'
					})
					.expect(404, function(error) {
						done(error);
					});
			});
		});
	});
});
