'use strict';

exports = module.exports = Example;

function Example() {
    //
}

Example.prototype.getTest = function() {
    return {
        title: 'Hello, world!',
        user: {
            id: 1,
            name: 'Martijn',
            email: 'a@b.c'
        }
    };
};

Example.prototype.getTest2 = function(test, $id) {
	return {
		test: $id
	};
};

Example.prototype.getTest3 = function(cookies) {
    if(this.session.test) {
        this.session.test++;
    }
    else {
        this.session.test = 1;
    }

    return {
        test: this.session.test
    };
};

Example.prototype.postTest4 = function(test) {
    return {
        test: this.param('test'),
        hello: 'WORLD'
    };
};