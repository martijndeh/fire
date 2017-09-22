import assert from 'assert';
import Simulator from 'sql-simulator';
import Builder from './builder.js';

export default class Model {
    static create(transaction) {
        //
    }

    static simulate(ast, transaction) {
        const tableNames = new Set(Object.keys(ast.tables));

        this.create(transaction);

        const newTableNames = Object.keys(ast.tables).filter((tableName) => !tableNames.has(tableName));

        assert(newTableNames.length === 1, `Multiple tables found in model. Only one is allowed.`);

        return new this(ast, newTableNames[0]);
    }

    constructor(ast, tableName) {
        this.ast = ast;
        this.tableName = tableName;
    }

    select(strings, ...parameters) {
        const builder = new Builder(this.ast, this.tableName);
        return builder.select(strings, ...parameters);
    }

    with(strings, ...parameters) {
        const builder = new Builder(this.ast, this.tableName);
        return builder.with(strings, ...parameters);
    }

    update(strings, ...parameters) {
        const builder = new Builder(this.ast, this.tableName);
        return builder.update(strings, ...parameters);
    }

    delete(strings, ...parameters) {
        const builder = new Builder(this.ast, this.tableName);
        return builder.delete(strings, ...parameters);
    }

    insert(strings, ...parameters) {
        const builder = new Builder(this.ast, this.tableName);
        return builder.insert(strings, ...parameters);
    }
}
