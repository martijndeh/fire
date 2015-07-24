var fire = require('fire');
var app = fire.app('chatbox');

app.directive(function autoFocus() {
    var $ = require('jquery');
    return function(scope, element) {
        $(element).focus();
    };
});
