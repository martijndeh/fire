import Simulator from 'sql-simulator';
import Table from '../table.js';
import Schema from '../schema.js';

describe(`tables`, () => {
    class Foo extends Table {
        static create(transaction) {
            transaction.sql `CREATE TABLE foo (
                id INTEGER PRIMARY KEY,
                value INTEGER NOT NULL
            )`;
        }
    }

    class Bar extends Table {
        static create(transaction) {
            transaction.sql `CREATE TABLE bar (
                id INTEGER PRIMARY KEY,
                foo_id INTEGER REFERENCES foo (id)
            )`;
        }
    }

    Schema.addTableClasses([
        Foo,
        Bar,
    ]);
    const simulator = new Simulator();
    const tableNames = Schema.loadTables(simulator);

    const ast = {
        ...simulator.toJSON(),
        tableNames,
    };
    const schema = new Schema(ast);

    it(`select with schema-aware from`, () => {
        const query = schema.foo.select `*`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM foo WHERE value > 10`);
    });

    it(`select with manual from`, () => {
        const query = schema.foo.select `*`
            .from `test`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM test WHERE value > 10`);
    });

    it(`select with schema-aware inner join`, () => {
        const query = schema.foo.select `*`
            .innerJoin `bar`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM foo INNER JOIN bar ON (foo.id = bar.foo_id) WHERE value > 10`);
    });

    it(`insert with a value`, () => {
        const value = 123;
        const query = schema.foo.insert({
                value,
            })
            .toQuery();

        expect(query).toEqual({
            text: `INSERT INTO foo (value) VALUES ($1)`,
            parameters: [value],
        });
    });

    it(`insert without values`, () => {
        const query = schema.foo.insert()
            .toQuery();

        expect(query).toEqual({
            text: `INSERT INTO foo DEFAULT VALUES`,
            parameters: [],
        });
    });
});
