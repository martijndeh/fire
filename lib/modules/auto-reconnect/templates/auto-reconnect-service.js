app.run(['$location', '$window', function($location, $window) {
    console.log('auto reconnect');

    var reload = false;

    var _connect = function() {
        console.log('_connect()');

        var socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
        socket.onopen = function() {
            console.log('socket.onopen ' + reload);

            if(reload) {
                $window.location.reload();
            }
        };

        socket.onerror = function() {
            console.log('socket.onerror');
        };

        socket.onclose = function() {
            console.log('socket.onclose');

            reload = true;

            setTimeout(_connect, 1000);
        };
    };

    _connect();
}]);
