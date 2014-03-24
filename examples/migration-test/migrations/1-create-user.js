exports = module.exports = CreateUser;

function CreateUser() {

}

CreateUser.prototype.up = function() {
    return this.createModel('User', {
        'name': [this.String],
        'password': [this.String],
        'email': [this.String]
    });
};

CreateUser.prototype.down = function() {
    return this.destroyModel('User');
};
