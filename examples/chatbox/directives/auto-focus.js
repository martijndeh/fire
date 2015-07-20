var fire = require('fire');
var app = fire.app('chatbox');

app.directive(function autoFocus() {
    return function(scope, element) {
        element.focus();
    };
});
