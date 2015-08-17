app.run(['$location', '$window', '$log', function($location, $window, $log) {
    var reload = false;
    var _connect = function() {
        var connected = false;

        var socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
        socket.onopen = function() {
            connected = true;

            if(reload) {
                $log.info('Reconnected. Reloading now.');
                
                $window.location.reload();
            }
        };

        socket.onclose = function() {
            if(connected) {
                $log.warn('Lost connection. Trying to reconnect.');
            }

            reload = true;

            setTimeout(_connect, 1000);
        };
    };

    _connect();
}]);
