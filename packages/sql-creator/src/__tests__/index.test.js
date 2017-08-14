import { cloneDeep } from 'lodash';
import Simulator from '../../../sql-simulator/src/index.js';
import createSql from '..';

describe(`creator`, () => {
    function create(from, to) {
        const fromSimulator = new Simulator();
        fromSimulator.tables = from;

        const toSimulator = new Simulator();
        toSimulator.tables = to;

        return createSql(fromSimulator, toSimulator);
    }

    it(`should add column`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.columns.value = {
            name: `value`,
            dataType: `TEXT`,
            constraints: {},
        };

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ADD COLUMN value TEXT`,
        ]);
    });

    it(`should drop column`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                    value: {
                        name: `value`,
                        dataType: `TEXT`,
                    },
                },
            },
        };
        const to = cloneDeep(from);
        delete to.test.columns.value;

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test DROP COLUMN value`,
        ]);
    });

    it(`should rename column`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                    value: {
                        name: `value`,
                        dataType: `TEXT`,
                        constraints: {
                            notNull: {},
                            primaryKey: {},
                        }
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.columns.test = to.test.columns.value;
        to.test.columns.test.name = `test`;
        delete to.test.columns.value;

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test RENAME COLUMN value TO test`,
        ]);
    });

    it(`should add table`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.account = {
            name: `account`,
            columns: {
                id: {
                    name: `id`,
                    dataType: `UUID`,
                    constraints: {
                        default: {
                            expression: `uuid_generate_v4()`,
                        },
                        primaryKey: {},
                    },
                },
            },
        };

        const queries = create(from, to);

        expect(queries).toEqual([
            `CREATE TABLE account (\n\tid UUID DEFAULT uuid_generate_v4() PRIMARY KEY\n)`,
        ]);
    });

    it(`should drop table`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = {};

        const queries = create(from, to);

        expect(queries).toEqual([
            `DROP TABLE test`,
        ]);
    });

    it(`should rename table`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.name = `test2`;
        to.test2 = to.test;
        delete to.test;

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test RENAME TO test2`,
        ]);
    });

    it(`should set default`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.columns.id.constraints.default = {
            expression: `1`,
        };

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ALTER COLUMN id SET DEFAULT 1`,
        ]);
    });

    it(`should drop default`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {
                            default: {
                                expression: `1`,
                            },
                        },
                    },
                },
            },
        };
        const to = cloneDeep(from);
        delete to.test.columns.id.constraints.default;

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ALTER COLUMN id DROP DEFAULT`,
        ]);
    });

    it(`should set not null`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.columns.id.constraints.notNull = {};

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ALTER COLUMN id SET NOT NULL`,
        ]);
    });

    it(`should drop not null`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {
                            notNull: {},
                        },
                    },
                },
            },
        };
        const to = cloneDeep(from);
        delete to.test.columns.id.constraints.notNull;

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ALTER COLUMN id DROP NOT NULL`,
        ]);
    });

    it(`should change data type`, () => {
        const from = {
            test: {
                name: `test`,
                columns: {
                    id: {
                        name: `id`,
                        dataType: `INTEGER`,
                        constraints: {},
                    },
                },
            },
        };
        const to = cloneDeep(from);
        to.test.columns.id.dataType = `TEXT`

        const queries = create(from, to);

        expect(queries).toEqual([
            `ALTER TABLE test ALTER COLUMN id SET DATA TYPE TEXT`,
        ]);
    });
});
