'use strict';

exports = module.exports = Example;

function Example() {

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
