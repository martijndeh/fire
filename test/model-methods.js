/* global describe, beforeEach, afterEach, it */
'use strict';

var fire = require('..');

var assert = require('assert');
var crypto = require('crypto');
var uuid = require('node-uuid');
var Model = require('../lib/modules/models/model');
var util = require('util');

var Q = require('q');
Q.longStackSupport = true;

describe('model methods', function() {
    var models;
    var app = null;

    beforeEach(function(done) {
        app = fire.app();
        app.run()
            .then(function() {
                models = app.models;

                done();
            })
            .done();
    });

    afterEach(function(done) {
        // TODO: We should drop everything in beforeEach instead.
        // But make sure we don't drop /everything/: only whatever the tests use
        // We don't want to delete any real tables because of a misconfiguration

        var result = Q.when(true);

        models.forEach(function(model) {
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

        result.then(function() {
            models = null;
            return app.stop();
        })
        .then(function() {
            done();
        })
        .catch(function(error) {
            done(error);
        })
        .done();
    });

    it('can create model with multiple associations of the same model', function(done) {
        models.Article = 'Article';
        models.User = 'User';
        models.UsersArticles = 'UsersArticles';

        function Article() {
            this.title = [this.String, this.Required];
            this.url = [this.String, this.Required];
            this.createdAt = [this.DateTime, this.Default('CURRENT_DATE')];
            this.submitter = [this.BelongsTo(this.models.User, 'submittedArticles'), this.AutoFetch, this.Required];
            this.voters = [this.HasMany(this.models.User, 'votedArticles'), this.AutoFetch];
        }
        fire.model(Article);

        function User() {
            this.name = [this.String, this.Required];
            this.votedArticles = [this.HasMany(this.models.Article, 'voters')];
            this.submittedArticles = [this.HasMany(this.models.Article, 'submitter')];
        }
        fire.model(User);

        setImmediate(function() {
            return models.User.setup()
                .then(function() {
                    return models.Article.setup();
                })
                .then(function() {
                    return models.ArticlesUsers.setup();
                })
                .then(function() {
                    return models.User.create({
                        name: 'Test Creator'
                    })
                })
                .then(function(user) {
                    return models.Article.create({
                        title: 'Test title.',
                        url: 'https://github.com/martijndeh/fire',
                        submitter: user
                    })
                        .then(function(article) {
                            return article.addVoter(user)
                                .then(function() {
                                    assert.equal(article.submitter.name, 'Test Creator');
                                    assert.equal(article.voters.length, 1);

                                    done();
                                })
                        })
                })
                .done();
        });
    });

    it('can create model when calling findOrCreate()', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.value = [this.Integer];
        }
        fire.model(ModelThree);

        setImmediate(function() {
            return models.ModelThree.setup()
                .then(function() {
                    return models.ModelThree.findOrCreate({name: 'Test'}, {value: 123});
                })
                .then(function(model) {
                    assert.equal(model.name, 'Test');
                    assert.equal(model.value, 123);

                    done();
                })
                .done();
        });
    });

    it('can find model with null column', function(done) {
        function ModelThree() {
            this.name = [this.String];
        }
        fire.model(ModelThree);

        setImmediate(function() {
            return models.ModelThree.setup()
            .then(function() {
                return models.ModelThree.create({name:null});
            })
            .then(function() {
                return models.ModelThree.findOne({});
            })
            .then(function(model) {
                assert.notEqual(model, null);
                assert.equal(model.name, null);
                return true;
            })
            .then(function() {
                return models.execute('SELECT * FROM "model_threes" WHERE "name" IS NULL LIMIT 1');
            })
            .then(function(model) {
                assert.notEqual(model, null);
                assert.equal(model.name, null);
                return true;
            })
            .then(function() {
                return models.ModelThree.findOne({name:null});
            })
            .then(function(model) {
                assert.notEqual(model, null);
                done();
            })
            .catch(function(error) {
                done(error);
            });
        });
    });

    it('can update with relation', function(done) {
        models.ModelThree = 'ModelThree';
        models.ModelFour = 'ModelFour';

        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        fire.model(ModelThree);

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree)];
        }
        fire.model(ModelFour);

        setImmediate(function() {
            return models.ModelThree.setup()
            .then(function() {
                return models.ModelFour.setup();
            })
            .then(function() {
                return models.ModelThree.create({
                    name: 'Test 1'
                });
            })
            .then(function(modelThree) {
                assert.notEqual(modelThree, null);
                assert.equal(modelThree.name, 'Test 1');

                return models.ModelFour.create({
                    three: modelThree
                })
                .then(function(modelFour) {
                    assert.notEqual(modelFour, null);
                    assert.equal(modelFour.three, modelThree.id);

                    return models.ModelFour.updateOne({
                        id: modelFour.id,
                        three: modelThree
                    }, {name:'Test 2'});
                });
            })
            .then(function(modelFour) {
                assert.notEqual(modelFour, null);
                assert.equal(modelFour.name, 'Test 2');
                done();
            })
            .done();
        });
    });

    it('can query on date', function(done) {
        function ModelThree() {
            this.name       = [this.String];
            this.createdAt  = [this.DateTime];
        }
        fire.model(ModelThree);

        var startDate = new Date(2014, 10, 23);
        var endDate = new Date(2014, 10, 24);
        var outsideDate = new Date(2015, 0, 1);

        setImmediate(function() {
            return models.ModelThree.setup()
            .then(function() {
                return models.ModelThree.create({
                    createdAt: startDate
                });
            })
            .then(function() {
                return models.ModelThree.create({
                    createdAt: endDate
                });
            })
            .then(function() {
                return models.ModelThree.create({
                    createdAt: outsideDate
                });
            })
            .then(function() {
                return models.ModelThree.findOne({
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate
                    }
                });
            })
            .then(function(model) {
                assert.notEqual(model, null);
                done();
            })
            .catch(function(error) {
                done(error);
            });
        });
    });

    it('can create foreign key association', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        fire.model(ModelThree);

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree), this.AutoFetch];
        }
        fire.model(ModelFour);

        setImmediate(function() {
            models.ModelThree.setup()
            .then(function() {
                return models.ModelFour.setup();
            })
            .then(function() {
                return models.ModelThree.create({
                    name: 'Three is a Test'
                });
            })
            .then(function(modelThree) {
                return models.ModelFour.create({
                    three: modelThree,
                    name: 'Four is a Test'
                });
            })
            .then(function(modelFour) {
                assert.notEqual(modelFour, null);
                return true;
            })
            .then(function() {
                return models.ModelFour.findOne({});
            })
            .then(function(model) {
                assert.equal(model.name, 'Four is a Test');
                assert.equal(model.three.name, 'Three is a Test');
                done();
            })
            .done();
        });
    });

    it('can find models with auto fetches', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        fire.model(ModelThree);

        ModelThree.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name,
                test: 'haha'
            };
        };

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree), this.AutoFetch];
        }
        fire.model(ModelFour);

        ModelFour.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name,
                three: this.three
            };
        };

        var modelThreeID = uuid.v4();

        setImmediate(function() {
            models.ModelThree.setup()
            .then(function() {
                return models.ModelFour.setup();
            })
            .then(function() {
                return models.ModelThree.create({
                    id: modelThreeID,
                    name: 'Three is a Test'
                });
            })
            .then(function(modelThree) {
                var creations = [];

                for(var i = 0; i < 10; i++) {
                    creations.push(models.ModelFour.create({
                        three: modelThree,
                        name: 'Four is a Test'
                    }));
                }

                return Q.all(creations);
            })
            .then(function() {
                return models.ModelFour.find({});
            })
            .then(function(modelFours) {
                assert.equal(modelFours.length, 10);

                modelFours.forEach(function(modelFour) {
                    assert.equal(modelFour.name, 'Four is a Test');
                    assert.equal(modelFour.three.id, modelThreeID);
                    assert.equal(modelFour.three.name, 'Three is a Test');
                });

                assert.notEqual(JSON.stringify(modelFours), null);

                done();
            })
            .done();
        });
    });

    it('can add auto-fetched many reference', function(done) {
        models.Client = 'Client';
        models.Project = 'Project';

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        fire.model(Project);

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.AutoFetch, this.HasMany(this.models.Project)];
        }
        fire.model(Client);

        setImmediate(function() {
            models.Client.setup()
                .then(function() {
                    return models.Project.setup();
                })
                .then(function() {
                    assert.notEqual(models.Client.getAssociations().projects, null);
                    assert.notEqual(models.Project.getAssociations().client, null);
                    return true;
                })
                .then(function() {
                    var _ = [];

                    for(var i = 0; i < 3; i++) {
                        _.push(models.Client.create({
                            name: 'Client #' + i
                        }));
                    }

                    return Q.all(_);
                })
                .then(function() {
                    return models.Client.find({});
                })
                .then(function(clients) {
                    assert.equal(clients.length, 3);

                    var _ = [];

                    for(var i = 0; i < 30; i++) {
                        _.push(models.Project.create({
                            name: 'Project #' + i,
                            client: clients[i % 3]
                        }));
                    }

                    return Q.all(_);
                })
                .spread(function() {
                    return models.Client.findOne({});
                })
                .then(function(client) {
                    assert.equal(client.projects.length, 10);
                    return models.Client.find({}, {name:'ASC'});
                })
                .then(function(clients) {
                    assert.equal(clients.length, 3);
                    clients.forEach(function(client) {
                        assert.equal(client.projects.length, 10);
                    });
                    done();
                })
                .catch(function(error) {
                    done(error);
                })
                .done();
        });
    });

    it('can add NON-auto-fetched many reference', function(done) {
        models.Client = 'Client';
        models.Project = 'Project';

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.HasMany(this.models.Project)];
        }
        fire.model(Client);

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        fire.model(Project);

        setImmediate(function() {
            models.Client.setup()
            .then(function() {
                return models.Project.setup();
            })
            .then(function() {
                assert.equal(models.Project.getProperty('client').columnName, 'client_id');
                return true;
            })
            .then(function() {
                var _ = [];

                for(var i = 0; i < 3; i++) {
                    _.push(models.Client.create({
                        name: 'Client #' + i
                    }));
                }

                return Q.all(_);
            })
            .then(function() {
                return models.Client.find({});
            })
            .then(function(clients) {
                assert.equal(clients.length, 3);

                var _ = [];

                for(var i = 0; i < 30; i++) {
                    _.push(models.Project.create({
                        name: 'Project #' + i,
                        client: clients[i % 3]
                    }));
                }

                return Q.all(_);
            })
            .then(function() {
                return models.Client.findOne({});
            })
            .then(function(client) {
                assert.equal(client.projects, null);
                assert.equal(typeof client.getProjects, 'function');

                return client.getProjects();
            })
            .then(function(projects) {
                assert.notEqual(projects, null);
                assert.equal(projects.length, 10);
                done();
            })
            .done();
        });
    });

    it('can create model with many reference in reverse order', function(done) {
        function Client() {
            this.name = [this.String];
            this.projects = [this.AutoFetch, this.HasMany(this.models.Project)];
        }
        fire.model(Client);

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        fire.model(Project);

        setImmediate(function() {
            models.loadClass(Client);
            models.loadClass(Project);

            for(var modelName in models.internals) {
                var ModelClass = models.internals[modelName];

                models._addModel(ModelClass, modelName);
            }

            for(var modelName in models.internals) {
                var model = models.internals[modelName];

                model.getTable().addProperties(model.getAllProperties(), false);
            }

            done();
        });
    });

    it('can get model with empty childs', function(done) {
        models.Client = 'Client';
        models.Project = 'Project';

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        fire.model(Project);

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.HasMany(this.models.Project), this.AutoFetch];
        }
        fire.model(Client);

        setImmediate(function() {
            models.Client.setup()
            .then(function() {
                return models.Project.setup();
            })
            .then(function() {
                return models.Client.create({name:'Test'});
            })
            .then(function(client) {
                assert.equal(client.projects.length, 0);

                return models.Client.findOne({});
            })
            .then(function(client) {
                assert.equal(client.projects.length, 0);
                done();
            })
            .done();
        });
    });

    it('can find model with child-child relations', function(done) {
        function User() {
            this.name = [this.String];
            this.cs = [this.HasMany(this.models.C)];
        }
        fire.model(User);

        function A() {
            this.name = [this.String];
            this.bs = [this.HasMany(this.models.B)];
        }
        fire.model(A);

        function B() {
            this.name = [this.String];
            this.a = [this.BelongsTo(this.models.A), this.AutoFetch];
            this.cs = [this.HasMany(this.models.C)];
        }
        fire.model(B);

        function C() {
            this.name = [this.String];
            this.createdAt = [this.DateTime];
            this.b = [this.BelongsTo(this.models.B), this.AutoFetch];
            this.user = [this.BelongsTo(this.models.User), this.Required];
        }
        fire.model(C);

        C.prototype.toJSON = function() {
            return {
                name: this.name,
                b: {
                    id: this.b.id,
                    name: this.b.name
                },
                user: {
                    id: this.user.id,
                    name: this.user.name
                }
            };
        };

        setImmediate(function() {
            var result = Q.when(true);

            result = result.then(function() {
                return models.User.setup();
            });

            result = result.then(function() {
                return models.A.setup();
            });

            result = result.then(function() {
                return models.B.setup();
            });

            result = result.then(function() {
                return models.C.setup();
            });

            return result
                .then(function() {
                    return models.User.create({name:'Martijn'});
                })
                .then(function(user) {
                    return models.A.create({name:'A'})
                        .then(function(a) {
                            return models.B.create({
                                name: 'B',
                                a: a
                            });
                        })
                        .then(function(b) {
                            return models.C.create({
                                name: 'C',
                                createdAt: null,
                                b: b,
                                user: user
                            });
                        })
                        .then(function() {
                            return models.C.findOne({
                                createdAt: null,
                                user: user
                            });
                        })
                        .then(function(c) {
                            assert.notEqual(c, null);
                            assert.notEqual(c.b, null);
                            assert.notEqual(c.b.a, null);

                            return done();
                        });
                })
                .catch(done)
                .done();
        });
    });

    it('can update model with relation in where', function(done) {
        // We set these to make sure forward-references work.
        models.Client = 'Client';
        models.Project = 'Project';

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client), this.AutoFetch, this.Required];
        }
        fire.model(Project);

        Project.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name
            };
        };

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.HasMany(this.models.Project)];
        }
        fire.model(Client);

        Client.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name
            };
        };

        setImmediate(function() {
            models.Client.setup()
            .then(function() {
                return models.Project.setup();
            })
            .then(function() {
                return Q.all([
                    models.Client.create({name:'Client 1'}),
                    models.Client.create({name:'Client 2'})
                ]);
            })
            .spread(function(client1, client2) {
                return models.Project.create({
                        name: 'Project 1',
                        client: client1
                    })
                    .then(function() {
                        return models.Project.update({
                            client: client1
                        }, {
                            client: client2,
                            name: 'Project 2'
                        });
                    })
                    .then(function(project) {
                        assert.notEqual(project, null);
                        assert.equal(project.name, 'Project 2');
                        assert.equal(project.client.name, 'Client 2');
                    })
                    .then(function() {
                        return models.Project.findOne();
                    });
            })
            .then(function(project) {
                assert.notEqual(project, null);
                assert.equal(project.name, 'Project 2');
                assert.equal(project.client.name, 'Client 2');

                done();
            })
            .catch(done)
            .done();
        });
    });

    it('can transform parameters to property value', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                return (title + ' ' + subtitle);
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        title: 'Title',
                        subtitle: 'Subtitle'
                    });
                })
                .then(function(object1) {
                    assert.notEqual(object1, null);
                    assert.equal(object1.name, 'Martijn');
                    assert.equal(object1.text, 'Title Subtitle');
                    assert.equal(object1.title, undefined);
                    assert.equal(object1.subtitle, undefined);

                    done();
                })
                .done();
        });
    });

    it('can transform parameters to property value promise', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                var defer = Q.defer();
                defer.resolve(title + ' ' + subtitle);
                return defer.promise;
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        title: 'Title',
                        subtitle: 'Subtitle'
                    });
                })
                .then(function(object1) {
                    assert.notEqual(object1, null);
                    assert.equal(object1.name, 'Martijn');
                    assert.equal(object1.text, 'Title Subtitle');
                    assert.equal(object1.title, undefined);
                    assert.equal(object1.subtitle, undefined);

                    done();
                })
                .done();
        });
    });

    it('can transform parameters to property value without values', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                return (title ? title : '') + ' ' + (subtitle ? subtitle : '');
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn'
                    });
                })
                .then(function(object1) {
                    assert.notEqual(object1, null);
                    assert.equal(object1.name, 'Martijn');
                    assert.equal(object1.text, ' ');
                    assert.equal(object1.title, undefined);
                    assert.equal(object1.subtitle, undefined);

                    done();
                })
                .done();
        });
    });

    it('can transform parameters to property value when updating', function(done) {
        function Object1() {
            this.name = [this.String];
            this.three = [this.Integer, this.Required, this.Transform(function(one, two) {
                return (one * two);
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        one: 2,
                        two: 4
                    });
                })
                .then(function(object1) {
                    assert.notEqual(object1, null);
                    assert.equal(object1.name, 'Martijn');
                    assert.equal(object1.three, 8);

                    return models.Object1.update({name: 'Martijn'}, {one: 3, two: 5});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn');
                    assert.equal(object.three, 15);

                    done();
                })
                .done();
        });
    });

    it('can transform using this to access other properties', function(done) {
        function Object1() {
            this.name = [this.String];
            this.two = [this.Integer];
            this.three = [this.Integer, this.Required, this.Transform(function(one) {
                return (one * this.two);
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        one: 2,
                        two: 4
                    });
                })
                .then(function(object1) {
                    assert.notEqual(object1, null);
                    assert.equal(object1.name, 'Martijn');
                    assert.equal(object1.three, 8);

                    return models.Object1.update({name: 'Martijn'}, {one: 3, two: 5});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn');
                    assert.equal(object.three, 15);

                    done();
                })
                .done();
        });
    });

    it('can find objects using select property type', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.Integer];
            this.test = [this.Virtual, this.Select(function(test) {
                return {
                    value: {
                        $gt: 10 * test - 5,
                        $lt: 10 * test + 5
                    }
                };
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return Q.all([
                        models.Object1.create({
                            name: 'Martijn 1',
                            value: 10,
                        }),
                        models.Object1.create({
                            name: 'Martijn 2',
                            value: 20
                        }),
                        models.Object1.create({
                            name: 'Martijn 3',
                            value: 30
                        })
                    ]);
                })
                .then(function(objects) {
                    assert.equal(objects.length, 3);

                    return models.Object1.findOne({test:1});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn 1');
                    assert.equal(object.value, 10);
                    assert.equal(object.test, undefined);

                    return models.Object1.findOne({test:2});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn 2');
                    assert.equal(object.value, 20);
                    assert.equal(object.test, undefined);

                    return models.Object1.findOne({test:3});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn 3');
                    assert.equal(object.value, 30);
                    assert.equal(object.test, undefined);

                    done();
                })
                .done();
        });
    });

    it('can update objects using select property type', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.Integer];
            this.test = [this.Virtual, this.Select(function(test) {
                return {
                    value: {
                        $gt: 10 * test - 5,
                        $lt: 10 * test + 5
                    }
                };
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return Q.all([
                        models.Object1.create({
                            name: 'Martijn 1',
                            value: 10,
                        }),
                        models.Object1.create({
                            name: 'Martijn 2',
                            value: 20
                        }),
                        models.Object1.create({
                            name: 'Martijn 3',
                            value: 30
                        })
                    ]);
                })
                .then(function(objects) {
                    assert.equal(objects.length, 3);

                    return models.Object1.update({test:1}, {name: 'Update 1', value: 120});
                })
                .then(function(object) {
                    assert.equal(object.name, 'Update 1');
                    assert.equal(object.value, 120);
                    assert.equal(object.test, undefined);

                    done();
                })
                .done();
        });
    });

    it('can set property with hash method', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.String, this.Hash(function(value) {
                var hash = crypto.createHash('md5');
                hash.update(value);
                return hash.digest('hex');
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        value: 'test'
                    });
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn');
                    assert.equal(object.value, '098f6bcd4621d373cade4e832627b4f6');

                    done();
                })
                .done();
        });
    });

    it('can set property with default method', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.String, this.Default(function() {
                return Q.delay(1).then(function() {
                    return 123;
                });
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn'
                    });
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn');
                    assert.equal(object.value, 123);

                    done();
                })
                .done();
        });
    });

    it('can set property without default method', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.String, this.Default(function() {
                return Q.delay(1).then(function() {
                    return 123;
                });
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        value: 1
                    });
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn');
                    assert.equal(object.value, 1);

                    done();
                })
                .done();
        });
    });

    it('will not set property with default method when updating', function(done) {
        function Object1() {
            this.name = [this.String];
            this.value = [this.String, this.Default(function() {
                return Q.delay(1).then(function() {
                    return 123;
                });
            })];
        }
        fire.model(Object1);

        setImmediate(function() {
            models.Object1.setup()
                .then(function() {
                    return models.Object1.create({
                        name: 'Martijn',
                        value: 1
                    });
                })
                .then(function(object) {
                    return models.Object1.update({
                        id: object.id
                    }, {
                        name: 'Martijn 2'
                    });
                })
                .then(function(object) {
                    assert.equal(object.name, 'Martijn 2');
                    assert.equal(object.value, 1);

                    done();
                })
                .done();
        });
    });

    it('creates auto toJSON', function(done) {
        function Article() {
            this.title = [this.String, this.Required];
            this.url = [this.String, this.Required];
            this.votes = [this.Integer, this.Default(0)];
            this.longerTest = [this.Integer];
        }
        fire.model(Article);

        setImmediate(function() {
            models.Article.setup()
                .then(function() {
                    return models.Article.create({
                        title: 'Title',
                        url: 'https://github.com/martijndeh/fire',
                        votes: 123,
                        longerTest: 42
                    });
                })
                .then(function(article) {
                    var string = JSON.stringify(article);
                    assert.equal(string, '{"id":"' + article.id + '","title":"Title","url":"https://github.com/martijndeh/fire","votes":123,"longerTest":42}');

                    done();
                })
                .done();
        });
    });

    it('creates auto toJSON with associations', function(done) {
        models.User = 'User';

        function Article() {
            this.title = [this.String, this.Required];
            this.url = [this.String, this.Required];
            this.user = [this.BelongsTo(this.models.User), this.AutoFetch];
        }
        fire.model(Article);

        function User() {
            this.name = [this.String];
            this.articles = [this.HasMany(this.models.Article), this.AutoFetch];
        }
        fire.model(User);

        var userID = uuid.v4();
        var article1ID = uuid.v4();
        var article2ID = uuid.v4();

        setImmediate(function() {
            models.User.setup()
                .then(function() {
                    return models.Article.setup();
                })
                .then(function() {
                    return models.User.create({
                        id: userID,
                        name: 'Martijn'
                    })
                    .then(function(user) {
                        return models.Article.create({
                            id: article1ID,
                            title: 'Title',
                            url: 'https://github.com/martijndeh/fire',
                            user: user
                        });
                    });
                })
                .then(function(article) {
                    var string = JSON.stringify(article);
                    assert.equal(string, '{"id":"' + article.id + '","title":"Title","url":"https://github.com/martijndeh/fire","user":{"id":"' + userID + '","name":"Martijn","articles":[]}}');

                    return models.User.findOne()
                        .then(function(user) {
                            return models.Article.create({
                                id: article2ID,
                                title: 'Title 2',
                                url: 'http://news.ycombinator.com/',
                                user: user
                            });
                        })
                        .then(function() {
                            return models.User.findOne();
                        });
                })
                .then(function(user) {
                    var string = JSON.stringify(user);
                    assert.equal(string, '{"id":"' + userID + '","name":"Martijn","articles":[{"id":"' + article1ID + '","title":"Title","url":"https://github.com/martijndeh/fire","user":{"id":"' + userID + '","name":"Martijn","articles":[]}},{"id":"' + article2ID + '","title":"Title 2","url":"http://news.ycombinator.com/","user":{"id":"' + userID + '","name":"Martijn","articles":[]}}]}');

                    done();
                })
                .done();
        });
    });

    it('hides private properties in auto toJSON', function(done) {
        function User() {
            this.name = [this.String, this.Required];
            this.password = [this.String, this.Required, this.Private];
        }
        fire.model(User);

        setImmediate(function() {
            models.User.setup()
                .then(function() {
                    return models.User.create({
                        name: 'Martijn',
                        password: 'very secret'
                    });
                })
                .then(function(user) {
                    var json = user.toJSON();

                    assert.equal(user.password, 'very secret');
                    assert.equal(json.password, null);

                    done();
                })
                .done();
        });
    });

    it('hides non-auto fetch associations in auto toJSON', function(done) {
        models.Project = 'Project';
        models.User = 'User';

        function User() {
            this.name = [this.String, this.Required];
            this.projects = [this.HasMany(this.models.Project)];
        }
        fire.model(User);

        function Project() {
            this.name = [this.String];
            this.user = [this.BelongsTo(this.models.User)];
        }
        fire.model(Project);

        setImmediate(function() {
            models.User.setup()
                .then(function() {
                    return models.Project.setup();
                })
                .then(function() {
                    return models.User.create({
                        name: 'Martijn'
                    });
                })
                .then(function(user) {
                    var json = user.toJSON();
                    assert.equal(typeof user.projects, 'undefined');

                    done();
                })
                .done();
        });
    });

    it('can create read-only property', function(done) {
        function Test() {
            this.testValue = [this.Integer, this.Required];
            this.position = [this.ReadOnly('$testValue * 3')];
        }
        fire.model(Test);

        setImmediate(function() {
            models.Test.setup()
                .then(function() {
                    return models.Test.create({
                        testValue: 123
                    });
                })
                .then(function(test) {
                    assert.equal(test.position, 123 * 3);

                    return models.Test.findOne();
                })
                .then(function(test) {
                    assert.equal(test.position, 123 * 3);

                    return models.Test.update(test.id, {testValue: 234});
                })
                .then(function(test) {
                    assert.equal(test.position, 234 * 3);

                    done();
                });
        });
    });

    it('can use read-only property in associations', function(done) {
        models.Test1 = 'Test1';
        models.Test2 = 'Test2';

        function Test1() {
            this.tests = [this.HasMany(this.models.Test2), this.AutoFetch];
        }
        fire.model(Test1);

        function Test2() {
            this.testValue = [this.Integer];
            this.position = [this.ReadOnly('$testValue * 3')];
            this.test = [this.BelongsTo(this.models.Test1)];
        }
        fire.model(Test2);

        setImmediate(function() {
            models.Test1.setup()
                .then(function() {
                    return models.Test2.setup();
                })
                .then(function() {
                    return models.Test1.create({});
                })
                .then(function(test) {
                    return Q.all([
                        models.Test2.create({
                            testValue: 1,
                            test: test
                        }),

                        models.Test2.create({
                            testValue: 2,
                            test: test
                        }),

                        models.Test2.create({
                            testValue: 3,
                            test: test
                        })
                    ]);
                })
                .spread(function(a, b, c) {
                    assert.equal(a.position, 1 * 3);
                    assert.equal(b.position, 2 * 3);
                    assert.equal(c.position, 3 * 3);

                    return models.Test1.findOne();
                })
                .then(function(test) {
                    assert.equal(test.tests[0].position, test.tests[0].testValue * 3);
                    assert.equal(test.tests[1].position, test.tests[1].testValue * 3);
                    assert.equal(test.tests[2].position, test.tests[2].testValue * 3);

                    done();
                })
                .done();
        });
    });

    it('can implement count property type', function(done) {
        models.Test1 = 'Test1';
        models.Test2 = 'Test2';

        function Test1() {
            this.tests = [this.HasMany(this.models.Test2), this.AutoFetch];
            this.numberOfTests = [this.Count('tests')];
        }
        fire.model(Test1);

        function Test2() {
            this.testValue = [this.Integer];
            this.test = [this.BelongsTo(this.models.Test1)];
        }
        fire.model(Test2);

        setImmediate(function() {
            models.Test1.setup()
                .then(function() {
                    return models.Test2.setup();
                })
                .then(function() {
                    return models.Test1.create({});
                })
                .then(function(test) {
                    return Q.all([
                        models.Test2.create({
                            testValue: 1,
                            test: test
                        }),

                        models.Test2.create({
                            testValue: 2,
                            test: test
                        }),

                        models.Test2.create({
                            testValue: 3,
                            test: test
                        })
                    ]);
                })
                .spread(function() {
                    return models.Test1.findOne();
                })
                .then(function(test) {
                    assert.equal(test.numberOfTests, 3);

                    done();
                })
                .done();
        });
    });

    it('can implement count property type in many-to-many relation', function(done) {
        models.Test1 = 'Test1';
        models.Test2 = 'Test2';

        function Test1() {
            this.tests = [this.HasMany(this.models.Test2), this.AutoFetch];
            this.numberOfTests = [this.Count('tests')];
        }
        fire.model(Test1);

        function Test2() {
            this.testValue = [this.Integer];
            this.tests = [this.HasMany(this.models.Test1)];
        }
        fire.model(Test2);

        setImmediate(function() {
            models.Test1.setup()
                .then(function() {
                    return models.Test2.setup();
                })
                .then(function() {
                    return models.Test1sTest2s.setup();
                })
                .then(function() {
                    return models.Test1.create({});
                })
                .then(function(test) {
                    return Q.all([
                        models.Test2.create({
                            testValue: 1
                        }),

                        models.Test2.create({
                            testValue: 2
                        }),

                        models.Test2.create({
                            testValue: 3
                        })
                    ]).spread(function(a, b, c) {
                        return Q.all([
                            test.addTest(a),
                            test.addTest(b),
                            test.addTest(c)
                        ]);
                    });
                })
                .then(function() {
                    return models.Test1.findOne();
                })
                .then(function(test) {
                    assert.equal(test.numberOfTests, 3);

                    done();
                })
                .done();
        });
    });

    it('can implement $count in read-only many-to-many relation', function(done) {
        models.Test1 = 'Test1';
        models.Test2 = 'Test2';

        function Test1() {
            this.tests = [this.HasMany(this.models.Test2), this.AutoFetch];
            this.value = [this.ReadOnly('$count("tests") * 2')];
        }
        fire.model(Test1);

        function Test2() {
            this.testValue = [this.Integer];
            this.tests = [this.HasMany(this.models.Test1)];
        }
        fire.model(Test2);

        setImmediate(function() {
            models.Test1.setup()
                .then(function() {
                    return models.Test2.setup();
                })
                .then(function() {
                    return models.Test1sTest2s.setup();
                })
                .then(function() {
                    return models.Test1.create({});
                })
                .then(function(test) {
                    return Q.all([
                        models.Test2.create({
                            testValue: 1
                        }),

                        models.Test2.create({
                            testValue: 2
                        }),

                        models.Test2.create({
                            testValue: 3
                        })
                    ])
                    .spread(function(a, b, c) {
                        return Q.all([
                            test.addTest(a),
                            test.addTest(b),
                            test.addTest(c)
                        ]);
                    });
                })
                .then(function() {
                    return models.Test1.findOne();
                })
                .then(function(test) {
                    assert.equal(test.value, 3 * 2);

                    done();
                })
                .done();
        });
    });

    it('can create with array', function(done) {
        function Test1() {
            this.value = [this.Integer];
        }
        fire.model(Test1);

        setImmediate(function() {
            models.Test1.setup()
                .then(function() {
                    return models.Test1.create([
                        {
                            value: 1
                        },
                        {
                            value: 2
                        },
                        {
                            value: 3
                        }
                    ]);
                })
                .then(function(tests) {
                    assert.equal(tests.length, 3);

                    return models.Test1.find();
                })
                .then(function(tests) {
                    assert.equal(tests.length, 3);
                    done();
                })
                .done();
        });
    });

    it('can find with sub-property', function(done) {
        models.Test1 = 'Test1';
        models.Test2 = 'Test2';

        function Test1() {
            this.test2 = [this.BelongsTo(this.models.Test2)];
            this.value = [this.Integer];
        }
        fire.model(Test1);

        function Test2() {
            this.name = [this.String];
            this.tests = [this.HasMany(this.models.Test1)];
        }
        fire.model(Test2);

        setImmediate(function() {
            models.Test2.setup()
                .then(function() {
                    return models.Test1.setup();
                })
                .then(function() {
                    return models.Test2.create([{name: 'Test 2 1'}, {name: 'Test 2 2'}, {name: 'Test 2 3'}]);
                })
                .then(function(test2s) {
                    return models.Test1.create([
                        {
                            test2: test2s[0],
                            value: 1
                        }, {
                            test2: test2s[1],
                            value: 2
                        }, {
                            test2: test2s[2],
                            value: 3
                        },
                    ]);
                })
                .then(function() {
                    return models.Test2.findOne({
                        'tests.value': 1
                    });
                })
                .then(function(test) {
                    assert.equal(test.name, 'Test 2 1');

                    return models.Test1.findOne({
                        'test2.name': 'Test 2 3'
                    });
                })
                .then(function(test) {
                    assert.equal(test.value, 3);

                    done();
                })
                .done();
        });
    });
});
