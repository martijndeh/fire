import Builder from './builder.js';

export default class Table {
    static create(_transaction) {}

    constructor(ast, name) {
        this.ast = ast;
        this.name = name;
    }

    select(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.select(strings, ...parameters);
    }

    with(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.with(strings, ...parameters);
    }

    update(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.update(strings, ...parameters);
    }

    delete(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.delete(strings, ...parameters);
    }

    insert(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.insert(strings, ...parameters);
    }

    sql(strings, ...parameters) {
        const builder = new Builder(this);
        return builder.sql(strings, ...parameters);
    }
}
