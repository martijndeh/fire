#### Under active development. Not feature-complete yet and currently unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire :fire:
A productive & convention-based web framework to get your minimum viable product ready in no-time built on top of [AngularJS](https://angularjs.org/), [express](http://expressjs.com/) and [PostgreSQL](http://www.postgresql.org/).

### Installation
```
npm install -g fire
```

### Features

1.  **Everything JavaScript**. You write front-end and back-end code in JavaScript. Moreover, switching between the ends is as easy as calling a regular method.

2. **Configuring Models**. You configure your models with the properties and Node on Fire automatically creates the schema, an automatic CRUD API and more.

3. **Database Everywhere**. You can query your database in both the back-end and the front-end side.

4. **Productive**. Node on Fire's main focus is to make iterating on your prototype or MVP faster. Try it out and you'll find out.

### Philosophy

A framework which allows you to write both client- and server-side code with as much reusability as possible in one language to rule them all to speed up iterations while embracing existing technologies instead of replacing them.

### Example

The below annotated example shows how easy it is to create a Hacker News-esque website.

```js
'use strict';

var fire = require('fire');

var app = fire.app('Hacker News', {
    modules: ['ngRoute'],
    stylesheets: ['/styles/default.css']
});

function User() {
    this.name 			= [this.String, this.Authenticate, this.Unique];
    this.articles 		= [this.HasMany(this.models.Article, 'author')];
    this.votes 			= [this.HasMany(this.models.Article, 'voters')];
    this.accessControl 	= [this.Read(function() { return true; }), this.Update(function() { return false; })];
}
app.model(User);

function Article() {
    this.title 			= [this.String, this.Required];
    this.url 			= [this.String, this.Required, this.Update(false), this.Unique];
    this.createdAt 		= [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
    this.author 		= [this.BelongsTo(this.models.User, 'articles'), this.Automatic, this.Required, this.AutoFetch];
    this.voters 		= [this.HasMany(this.models.User, 'votes'), this.Private];
    this.votes			= [this.Count('voters')];
    this.position 		= [this.ReadOnly('($count("voters") - 1) / ((EXTRACT(EPOCH FROM current_timestamp - $createdAt) / 3600) + 2)^1.8')];
    this.accessControl 	= [this.Read(function() { return true; }), this.Update('author'), this.Delete(function() { return false; })];
}
app.model(Article);

function NewsController(fire, $scope) {
    $scope.articles = fire.unwrap(fire.models.Article.find(), []);
    $scope.user 	= fire.unwrap(fire.models.User.getMe(), {});

    $scope.voteArticle = function(article) {
        fire.doVoteArticle(article.id)
            .then(function(updatedArticle) {
                article.votes = updatedArticle.votes;
                article.position = updatedArticle.position;
            })
            .catch(function(error) {
                alert(error);
            });
    };
}
app.controller(NewsController);

NewsController.prototype.view = function() {
    return this.template('list.jade');
};

NewsController.prototype.doVoteArticle = ['/api/articles/:articleID/voters', function($articleID) {
    var self = this;
    return this.models.Article.getOne({id: $articleID})
        .then(function(article) {
            return article.findVoter(self.findAuthenticator())
                .then(function(voter) {
                    if(voter) {
                        var error = new Error('Conflict');
                        error.status = 409;
                        throw error;
                    }
                    else {
                        return article.addVoter(self.findAuthenticator())
                            .then(function() {
                                return self.models.Article.getOne({id: $articleID});
                            });
                    }
                });
        });
}];

function ArticleController(fire, $scope, $routeParams) {
    $scope.article = fire.unwrap(fire.models.Article.findOne({id: $routeParams.id}), {});
}
fire.controller(ArticleController);

ArticleController.prototype.viewArticle = function($id) {
    return this.template('article.jade');
};

function SubmitController(fire, $scope, $location) {
    fire.models.User.getMe()
        .then(function(user) {
            $scope.user = user;
        })
        .catch(function(error) {
            $location.path('/login');
        });

    $scope.submitArticle = function(article) {
        fire.models.Article.create(article)
            .then(function() {
                $location.path('/');
            })
            .catch(function(error) {
                alert(error);
            });
    };
}
app.controller(SubmitController);

SubmitController.prototype.viewSubmit = function() {
    return this.template('submit.jade');
};

function LoginController(fire, $scope, $location) {
    $scope.loginUser = function(user) {
        fire.models.User.authorize(user)
            .then(function(user) {
                $location.path('/');
            })
            .catch(function(error) {
                alert(error);
            });
    };

    $scope.createUser = function(user) {
        fire.models.User.create(user)
            .then(function() {
                $location.path('/');
            })
            .catch(function(error) {
                alert(error);
            });
    };
};
app.controller(LoginController);

LoginController.prototype.viewLogin = function() {
    return this.template('login.jade');
};

app.run();
```

`cd` to `examples/hacker-news` and run the app via `$ fire`. To view the demo, go to http://127.0.0.1:3000/.

The `fire` command is simply an aggregation of multiple commands and is merely provided for your convenience.

### Stay up-to-date

Be the first to find out about any major release, sign up at http://nodeonfire.launchrock.co/.

### Documentation

The documentation will be available at https://github.com/martijndeh/fire/wiki. It's currently a work-in-progress. Sign up to receive an email about any release updates at http://nodeonfire.launchrock.co/.

### Roadmap

- Implement web-to-worker communication via message queueing.
- Replace query building with knex.
- Improve associations api and improve query API e.g. limit and orderBy on update.
- Fix weird authenticator system.
- Use Yeoman 

### Help

**Node on Fire** :fire: still has a long way to go and needs your help. Please fork and help us improve it in any way you can.

[![Analytics](https://ga-beacon.appspot.com/UA-52717773-2/fire/readme)](https://github.com/igrigorik/ga-beacon)
