'use strict';

var fire = require('../..');

var app = fire.app('First App', {modules:['ngRoute']});

app.template('list', '<div ng-controller="IndexController"><ul><li ng-repeat="article in articles"><a ng-href="/article/{{article.id}}">{{article.title}}</a></li></ul></div>');
app.template('article', '<div ng-controller="ArticleController"><h1>{{article.title}}</h1></div>');

var articles = [{
    id: 1,
    title: 'Where I\'m at'
},{
    id: 2,
    title: 'The Morning'
},{
    id: 3,
    title: 'Parallels'
},{
    id: 4,
    title: 'Mansions Of Los Feliz'
}];

function IndexController(fire, $scope) {
    $scope.articles = fire.unwrap(fire.getArticles(), []);
}
app.controller(IndexController);

IndexController.prototype.view = function() {
    return this.template('list');
};

IndexController.prototype.getArticles = function() {
    return articles;
};

function ArticleController(fire, $scope, $routeParams) {
    $scope.article = fire.unwrap(fire.getArticle($routeParams.id), {});
}
app.controller(ArticleController);

ArticleController.prototype.viewArticle = function($id) {
    return this.template('article');
};

ArticleController.prototype.getArticle = function($id) {
    return articles[$id - 1];
};

app.run();
