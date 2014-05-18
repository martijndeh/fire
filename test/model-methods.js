var fire = require('..');
var Models = require('./../lib/models');
var assert = require('assert');

var Q = require('q');
Q.longStackSupport = true;

describe('models', function() {
    var models;
    beforeEach(function(done) {
        models = new Models();
        models.setup(null)
            .then(function() {
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
            done();
        })
        .done();
    });

    it('can create model when calling findOrCreate()', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.value = [this.Integer];
        }
        models.addModel(ModelThree);
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
    })

    it('can find model with null column', function(done) {
        function ModelThree() {
            this.name = [this.String];
        }
        models.addModel(ModelThree);
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
        .fail(function(error) {
            done(error);
        })
    });

    it('can update with relation', function(done) {
        models.ModelThree = 'ModelThree';
        models.ModelFour = 'ModelFour';

        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        models.addModel(ModelThree);

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree)];
        }
        models.addModel(ModelFour);

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
                assert.equal(modelFour.three, 1);

                return models.ModelFour.updateOne({
                    id: modelFour.id,
                    three: modelThree
                }, {name:'Test 2'});
            })
        })
        .then(function(modelFour) {
            assert.notEqual(modelFour, null);
            assert.equal(modelFour.name, 'Test 2');
            done();
        })
        .done();
    })

    it('can query on date', function(done) {
        function ModelThree() {
            this.name       = [this.String];
            this.createdAt  = [this.DateTime];
        }
        models.addModel(ModelThree);

        var startDate = new Date(2014, 10, 23);
        var endDate = new Date(2014, 10, 24);
        var outsideDate = new Date(2015, 0, 1);

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
        .fail(function(error) {
            done(error);
        })
    });

    it('can create foreign key association', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        models.addModel(ModelThree);

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree), this.AutoFetch];
        }
        models.addModel(ModelFour);

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

    it('can find models with auto fetches', function(done) {
        function ModelThree() {
            this.name = [this.String];
            this.modelFour = [this.HasOne(this.models.ModelFour)];
        }
        ModelThree.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name,
                test: 'haha'
            };
        }
        models.addModel(ModelThree);

        function ModelFour() {
            this.name = [this.String];
            this.three = [this.BelongsTo(this.models.ModelThree), this.AutoFetch];
        }
        ModelFour.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name,
                three: this.three
            };
        }
        models.addModel(ModelFour);

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
                assert.equal(modelFour.three.id, 1);
                assert.equal(modelFour.three.name, 'Three is a Test');
            });

            assert.notEqual(JSON.stringify(modelFours), null);

            done();
        })
        .done();
    });

    it('can add auto-fetched many reference', function(done) {
        models.Client = 'Client';
        models.Project = 'Project';
        
        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        models.addModel(Project);

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.AutoFetch, this.HasMany(this.models.Project)];
        }
        models.addModel(Client);

        models.Client.setup()
        .then(function() {
            return models.Project.setup();
        })
        .then(function() {
            assert.notEqual(models.Client.getAssociations()['projects'], null);
            assert.notEqual(models.Project.getAssociations()['client'], null);
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
        .done();
    });

    it('can add NON-auto-fetched many reference', function(done) {
        models.Client = 'Client';
        models.Project = 'Project';

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.HasMany(this.models.Project)];
        }
        models.addModel(Client);

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        models.addModel(Project);

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

    it('can create model with many reference in reverse order', function(done) {
        function Client() {
            this.name = [this.String];
            this.projects = [this.AutoFetch, this.HasMany(this.models.Project)];
        }

        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }

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

    it('can get model with empty childs', function(done) {
        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client)];
        }
        models.addModel(Project);

        function Client() {
            this.name       = [this.String];
            this.projects   = [this.HasMany(this.models.Project), this.AutoFetch];
        }
        models.addModel(Client);

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

    it('can find model with child-child relations', function(done) {
        function User() {
            this.name = [this.String];
            this.cs = [this.HasMany(this.models.C)];
        }

        function A() {
            this.name = [this.String];
            this.bs = [this.HasMany(this.models.B)];
        }

        function B() {
            this.name = [this.String];
            this.a = [this.BelongsTo(this.models.A), this.AutoFetch];
            this.cs = [this.HasMany(this.models.C)];
        }

        function C() {
            this.name = [this.String];
            this.createdAt = [this.DateTime];
            this.b = [this.BelongsTo(this.models.B), this.AutoFetch];
            this.user = [this.BelongsTo(this.models.User), this.Required];
        }

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

        models.addModel(User);
        models.addModel(A);
        models.addModel(B);
        models.addModel(C);

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
            .fail(done)
            .done();
    });

    it('can update model with relation in where', function(done) {
        function Project() {
            this.name = [this.String];
            this.client = [this.BelongsTo(this.models.Client), this.AutoFetch, this.Required];
        }
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
        Client.prototype.toJSON = function() {
            return {
                id: this.id,
                name: this.name
            };
        }
        models.addModel(Client);
        models.addModel(Project);

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
                .then(function(project) {
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
                })
        })
        .then(function(project) {
            assert.notEqual(project, null);
            assert.equal(project.name, 'Project 2');
            assert.equal(project.client.name, 'Client 2');

            done();            
        })
        .fail(done)
        .done();
    });

    it('can transform parameters to property value', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                return (title + ' ' + subtitle);
            })];
        }

        models.addModel(Object1);

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

    it('can transform parameters to property value promise', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                var defer = Q.defer();
                defer.resolve(title + ' ' + subtitle);
                return defer.promise;
            })];
        }

        models.addModel(Object1);

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

    it('can transform parameters to property value without values', function(done) {
        function Object1() {
            this.name = [this.String];
            this.text = [this.String, this.Required, this.Transform(function(title, subtitle) {
                return (title ? title : '') + ' ' + (subtitle ? subtitle : '');
            })];
        }

        models.addModel(Object1);

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

    it('can transform parameters to property value when updating', function(done) {
        function Object1() {
            this.name = [this.String];
            this.three = [this.Integer, this.Required, this.Transform(function(one, two) {
                return (one * two);
            })];
        }

        models.addModel(Object1);

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

        models.addModel(Object1);

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

        models.addModel(Object1);

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
