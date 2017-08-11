import { cloneDeep } from 'lodash';
import createSql from '..';

describe.only(`creator`, () => {
    it(`should add column`, () => {
        const from = {
            test: {
                name: `test`,
                columns: [{
                    name: `id`,
                    dataType: `INTEGER`,
                    constraints: {},
                }]
            }
        };
        const to = cloneDeep(from);
        to.test.columns.push({
            name: `value`,
            dataType: `TEXT`,
            constraints: {},
        });

        const queries = createSql(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ADD COLUMN value TEXT`,
        ]);
    });

    // constraints: set default, drop default, set not null, drop not null, etc.
});
