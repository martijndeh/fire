var dotenv = require('dotenv-save');
dotenv.load({silent: true});

module.exports = process.env.NODE_COV ? require('./lib-cov/firestarter') : require('./lib/firestarter');
