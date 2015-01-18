/* global describe, beforeEach, afterEach, before, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');
var helper = require('./support/helper');
var fs = require('fs');
var path = require('path');

describe('access control', function() {
	var app = null;
	var createModels = null;
	var modules = null;

	beforeEach(function(done) {
		app = fire.app('accessControlTest', {});

		if(createModels) {
			createModels();
		}

		app.start()
			.then(function() {
				var result = Q.when(true);

				app.models.forEach(function(model) {
		            result = result.then(function() {
		                return model.exists()
		                	.then(function(exists) {
		                    	if(!exists) {
		                        	return model.setup();
		                    	}
		                    	else {
		                        	return true;
		                    	}
		                	});
		            	});
	        	});

	        	return result;
			})
			.then(function() {
				var defer = Q.defer();

				fs.mkdir(path.join(__dirname, '..', 'temp'), function() {
					defer.resolve();
				});

				return defer.promise;
			})
			.then(function() {
				var result = Q.when(true);

				modules = [];

				app.models.forEach(function(model) {
					if(!model.disableAutomaticModelController) {
						result = result.then(function() {
							var writeStream = fs.createWriteStream(path.join(__dirname, '..', 'temp', model.getName().toLowerCase() + '.js'));

							return app.API.generateModelController(model, writeStream)
								.then(function() {
									modules.push(writeStream.path);

									require(writeStream.path);
								});
						});
					}
				});

				return result;
			})
			.then(function() {
				var defer = Q.defer();
				setImmediate(defer.makeNodeResolver());
				return defer.promise;
			})
			.then(function() {
				done();
			})
			.catch(function(error) {
				done(error);
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
				if(modules) {
					modules.forEach(function(modulPath) {
						delete require.cache[modulPath];
					});
				}
			})
        	.then(function() {
            	done();
        	})
        	.done();
	});

	describe('article access control', function() {
		var agent = null;

		before(function() {
			createModels = function() {
				function User() {
					this.name = [this.String, this.Authenticate];
					this.articles = [this.HasMany(this.models.Article)];
				}
				app.model(User);

				User.prototype.toJSON = function() {
					return {
						id: this.id,
						accessToken: this.accessToken,
						name: this.name
					};
				};

				function Article() {
					this.title = [this.String];
					this.author = [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch];
					this.accessControl = [this.CanRead(true), this.CanUpdate('author'), this.CanDelete(false), this.CanCreate(function(authenticator) {
						return (authenticator && authenticator.name == 'Martijn');
					})];
				}
				app.model(Article);

				Article.prototype.toJSON = function() {
					return {
						id: this.id,
						title: this.title,
						author: this.author
					};
				};
			};
		});

		beforeEach(function(done) {
			app.models.User.create({name: 'Martijn', password: 'test'})
				.then(function() {
					agent = request.agent(app.HTTPServer.express);

					// We authorize. This should set a session variable.
					agent.post('/api/users/authorize')
						.set('X-JSON-Params', true)
						.send(helper.jsonify({name: 'Martijn', password: 'test'}))
						.expect(200, function(error, response) {
							assert.equal(response.body.name, 'Martijn');
							assert.notEqual(response.body.accessToken, null);
							assert.equal(response.body.password, null);

							done(error);
						});
				})
				.catch(function(error) {
					done(error);
				})
				.done();
		});

		it('can create article', function(done) {
			agent.post('/api/articles')
				.send({
					title: 'Test Title'
				})
				.expect(200, function(error, response) {
					assert.equal(error, null);
					assert.equal(response.body.title, 'Test Title');
					assert.equal(response.body.author.name, 'Martijn');

					done(error);
				});
		});

		it('cannot create article when unauthorized', function(done) {
			var noone = request.agent(app.HTTPServer.express);

			noone.post('/api/articles')
				.set('X-JSON-Params', true)
				.send(helper.jsonify({
					title: 'Malicious'
				}))
				.expect(401, function(error, response) {
					done(error);
				});
		});

		it('cannot create article when not Martijn', function(done) {
			var smith = request.agent(app.HTTPServer.express);

			app.models.User.create({name: 'Agent Smith', password: 'test'})
				.then(function() {
					smith.post('/api/users/authorize')
						.set('X-JSON-Params', false)
						.send({name: 'Agent Smith', password: 'test'})
						.expect(200, function() {
							smith.post('/api/articles')
								.set('X-JSON-Params', false)
								.send({title: '+1 + -1'})
								.expect(403, function(error) {
									done(error);
								});
						});
				});
		});

		describe('update article', function() {
			var articleId = -1;

			beforeEach(function(done) {
				agent.post('/api/articles')
					.send(helper.jsonify({title: 'Test'}))
					.expect(200, function(error, response) {
						assert.notEqual(response.body.id, null);

						articleId = response.body.id;

						done(error);
					});
			});

			it('can update article', function(done) {
				agent.put('/api/articles/' + articleId)
					.send({title: 'Rename'})
					.expect(200, function(error, response) {
						assert.equal(response.body.id, articleId);
						assert.equal(response.body.title, 'Rename');

						done(error);
					});
			});

			it('cannot update id', function(done) {
				agent
					.put('/api/articles/' + articleId)
					.send(helper.jsonify({
						id: 123
					}))
					.expect(400, function(error) {
						done(error);
					});
			});

			it('cannot update article when unauthorized', function(done) {
				var newTitle = 'Not Possible ' + Math.floor(Math.random() * 1000);

				request.agent(app.HTTPServer.express)
					.put('/api/articles/' + articleId)
					.send(helper.jsonify({title: newTitle}))
					.expect(401, function(error) {
						app.models.Article.getOne({id:articleId})
							.then(function(article) {
								assert.notEqual(article.title, newTitle);

								done(error);
							})
							.done();
					});
			});

			it('cannot update article when not correctly authorized', function(done) {
				var smith = request.agent(app.HTTPServer.express);

				app.models.User.create({name: 'Agent Smith', password: 'test'})
					.then(function() {
						smith.post('/api/users/authorize')
							.send({name: 'Agent Smith', password: 'test'})
							.expect(200, function(error1) {
								assert.equal(error1, null);
								smith.put('/api/articles/' + articleId)
									.send({title: '+1 + -1'})
									.expect(403, function(error2) {
										done(error2);
									});
							});
					});
			});
		});

		it('can read articles', function(done) {
			agent
				.get('/api/articles')
				.send()
				.expect(200, function(error) {
					done(error);
				});
		});

		it('can delete article', function(done) {
			agent
				.delete('/api/articles/1')
				.send()
				.expect(403, function(error) {
					done(error);
				});
		});
	});
});
