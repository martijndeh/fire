exports = module.exports = Context;

var Q = require('q');
var Cookies = require('cookies');

function Context(webSocket, authenticatorModel) {
    this.webSocket = webSocket;

    this.send = function(messageMap) {
        webSocket.send(JSON.stringify(messageMap));
    };

    this.findAuthenticator = function() {
        if(!authenticatorModel) {
    		return Q.when(null);
    	}

        var cookies = new Cookies(this.webSocket.upgradeReq, {}, process.env.SESSION_KEYS.split(','));
        var sid = cookies.get('sid');
        var session = {};
        if(sid) {
            try {
                session = JSON.parse(new Buffer(sid, 'base64').toString('utf8'));
            }
            catch(e) {
                //
            }
        }

    	return authenticatorModel.findOne({accessToken:session.at});
    };
}
