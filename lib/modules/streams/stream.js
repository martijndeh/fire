exports = module.exports = Stream;

function Stream(messageMap, connection) {
    this.id = messageMap.id;
    this.whereMap = messageMap.params[0] || {};
    this.optionsMap = messageMap.params[1] || {};
    this.modelName = messageMap.name;
    this.connection = connection;
    this.close = null;
}
