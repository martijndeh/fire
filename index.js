var dotenv = require('dotenv');
dotenv.load();

module.exports = process.env.NODE_COV ? require('./lib-cov/firestarter') : require('./lib/firestarter');
