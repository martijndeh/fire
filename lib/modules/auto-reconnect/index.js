exports = module.exports = AutoReconnect;

var path = require('path');

function AutoReconnect(bridge) {
    if(process.env.NODE_ENV == 'development') {
        this.generator = function() {
            return new bridge.Generator(path.join(__dirname, 'templates', 'auto-reconnect-service.js'), {});
        };
    }

    this.stages = ['build'];
}
