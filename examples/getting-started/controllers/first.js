'use strict';

var fire = require('../../..');
var app = fire.app();

function FirstController($scope) {
    $scope.name = 'world';
}
app.controller(FirstController);

FirstController.prototype.view = function() {
    return this.template('index.jade');
};
