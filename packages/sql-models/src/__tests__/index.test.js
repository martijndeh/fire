import Simulator from 'sql-simulator';
import Model from '../model.js';

describe(`models`, () => {
    class Foo extends Model {
        static create(transaction) {
            transaction.sql `CREATE TABLE foo (
                id INTEGER PRIMARY KEY,
                value INTEGER NOT NULL
            )`;
        }
    }

    class Bar extends Model {
        static create(transaction) {
            transaction.sql `CREATE TABLE bar (
                id INTEGER PRIMARY KEY,
                foo_id INTEGER REFERENCES foo (id)
            )`;
        }
    }

    const ast = new Simulator();
    const transaction = {
        sql(strings) {
            ast.simulateQuery(strings[0]);
        }
    };

    const foo = Foo.simulate(ast, transaction);
    const _bar = Bar.simulate(ast, transaction);

    it(`select with schema-aware from`, () => {
        const query = foo.select `*`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM foo WHERE value > 10`);
    });

    it(`select with manual from`, () => {
        const query = foo.select `*`
            .from `test`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM test WHERE value > 10`);
    });

    it(`select with schema-aware inner join`, () => {
        const query = foo.select `*`
            .innerJoin `bar`
            .where `value > 10`
            .toQuery();

        expect(query.text).toEqual(`SELECT * FROM foo INNER JOIN bar ON (foo.id = bar.foo_id) WHERE value > 10`);
    });
});
