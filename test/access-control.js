/* global describe, beforeEach, afterEach, before, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');
var helper = require('./support/helper');

describe('access control', function() {
	var app = null;
	var createModels = null;

	beforeEach(function(done) {
		app = fire.app('accessControlTest', {});

		if(createModels) {
			createModels();
		}

		app.run()
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
					this.accessControl = [this.Read(function() { return true; }), this.Update('author'), this.Delete(function() { return false; }), this.Create(function(user) {
						return (user && user.name == 'Martijn');
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
					agent = request.agent(app.express);

					// We authorize. This should set a session variable.
					agent.post('/api/users/authorize')
						.send(helper.jsonify({name: 'Martijn', password: 'test'}))
						.expect(200, function(error, response) {
							assert.equal(error, null);
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
				.send(helper.jsonify({
					title: 'Test Title'
				}))
				.expect(200, function(error, response) {
					console.log(error);

					assert.equal(error, null);
					assert.equal(response.body.title, 'Test Title');
					assert.equal(response.body.author.name, 'Martijn');

					done(error);
				});
		});

		it('cannot create article when unauthorized', function(done) {
			var noone = request.agent(app.express);

			noone.post('/api/articles')
				.send(helper.jsonify({
					title: 'Malicious'
				}))
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot create article when not Martijn', function(done) {
			var smith = request.agent(app.express);

			app.models.User.create({name: 'Agent Smith', password: 'test'})
				.then(function() {
					smith.post('/api/users/authorize')
						.send(helper.jsonify({name: 'Agent Smith', password: 'test'}))
						.expect(200, function() {
							smith.post('/api/articles')
								.send(helper.jsonify({title: '+1 + -1'}))
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
					.send(helper.jsonify({title: 'Rename'}))
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

				request.agent(app.express)
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
				var smith = request.agent(app.express);

				app.models.User.create({name: 'Agent Smith', password: 'test'})
					.then(function() {
						smith.post('/api/users/authorize')
							.send(helper.jsonify({name: 'Agent Smith', password: 'test'}))
							.expect(200, function(error1) {
								assert.equal(error1, null);
								smith.put('/api/articles/' + articleId)
									.send(helper.jsonify({title: '+1 + -1'}))
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

		it('cannot delete article', function(done) {
			agent
				.delete('/api/articles/1')
				.send()
				.expect(404, function(error) {
					// TODO: Actually implement delete.
					done(error);
				});
		});
	});
});
