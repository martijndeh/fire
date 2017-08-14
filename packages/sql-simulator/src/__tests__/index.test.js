import { cloneDeep } from 'lodash';
import Simulator from '../index.js';

describe(`Simulator`, () => {
    let simulator = null;

    beforeEach(() => {
        simulator = new Simulator();
    });

    describe(`CREATE TABLE`, () => {
        function simulate(query, result) {
            simulator.simulateQuery(query);

            expect(simulator.tables).toEqual(result);
        }

        it(`should create basic table with different data types`, () => {
            const query = `CREATE TABLE account (
                id INTEGER,
                first_name TEXT,
                last_name MySpecialType
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                        first_name: {
                            dataType: `TEXT`,
                            name: `first_name`,
                            constraints: {},
                        },
                        last_name: {
                            dataType: `MySpecialType`,
                            name: `last_name`,
                            constraints: {},
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with PRIMARY KEY`, () => {
            const query = `CREATE TABLE account (
                id INTEGER PRIMARY KEY
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                primaryKey: {},
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with NOT NULL`, () => {
            const query = `CREATE TABLE account (
                id INTEGER NOT NULL
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                notNull: {},
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        describe(`getInScope`, () => {
            function testScope(testString) {
                it(testString, () => {
                    simulator.input = `(${testString})`;
                    simulator.scope(() => {
                        const inScope = simulator.getInScope();

                        expect(inScope).toEqual(testString);
                    });
                });
            }

            testScope(`value > 0`);
            testScope(`value + (123 / 2) < 0`);
            testScope(`value + "te)st"`);
            testScope(`value + "'"`);
            testScope(`value + "\`"`);
            testScope(`value + "\`"`);
            testScope(`value \\)`);
        });

        it(`should create table with CHECK`, () => {
            const query = `CREATE TABLE account (
                id INTEGER CHECK (id > 0)
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                check: {
                                    expression: `id > 0`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with DEFAULT NOW()`, () => {
            const query = `CREATE TABLE account (
                id TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `TIMESTAMP WITHOUT TIME ZONE`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `NOW()`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with DEFAULT uuid_generate_v4() and primary key`, () => {
            const query = `CREATE TABLE account (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `UUID`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `uuid_generate_v4()`,
                                },
                                primaryKey: {},
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with DEFAULT 1`, () => {
            const query = `CREATE TABLE account (
                id TIMESTAMP WITHOUT TIME ZONE DEFAULT 1
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `TIMESTAMP WITHOUT TIME ZONE`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `1`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with DEFAULT "test"`, () => {
            const query = `CREATE TABLE account (
                id TIMESTAMP WITHOUT TIME ZONE DEFAULT "test"
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `TIMESTAMP WITHOUT TIME ZONE`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `"test"`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with DEFAULT "test"`, () => {
            const query = `CREATE TABLE account (
                id TIMESTAMP WITHOUT TIME ZONE DEFAULT "test"
            )`;
            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `TIMESTAMP WITHOUT TIME ZONE`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `"test"`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });

        it(`should create table with column with references constraint`, () => {
            const query = `CREATE TABLE account (
                id INTEGER REFERENCES test (id)
            )`;

            const tables = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                references: {
                                    tableName: `test`,
                                    columnName: `id`,
                                },
                            },
                        },
                    },
                },
            };

            simulate(query, tables);
        });
    });

    describe(`ALTER TABLE`, () => {
        function simulate(tables, query, result) {
            simulator.tables = tables;
            simulator.simulateQuery(query);

            expect(simulator.tables).toEqual(result);
        }

        it(`should drop table`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `DROP TABLE account`;

            simulate(before, query, {});
        });

        it(`should drop column`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account DROP COLUMN id`;

            const after = cloneDeep(before);
            delete after.account.columns.id;

            simulate(before, query, after);
        });

        it(`should add column with not null`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ADD COLUMN name TEXT NOT NULL`;

            const after = cloneDeep(before);
            after.account.columns.name = {
                dataType: `TEXT`,
                name: `name`,
                constraints: {
                    notNull: {},
                },
            };

            simulate(before, query, after);
        });

        it(`should add column with default "test"`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ADD COLUMN name TEXT DEFAULT "test"`;

            const after = cloneDeep(before);
            after.account.columns.name = {
                dataType: `TEXT`,
                name: `name`,
                constraints: {
                    default: {
                        expression: `"test"`,
                    },
                },
            };

            simulate(before, query, after);
        });

        it(`should alter column [set data] type`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id TYPE SERIAL`;

            const after = cloneDeep(before);
            after.account.columns.id.dataType = `SERIAL`;

            simulate(before, query, after);
        });

        it(`should alter column set data type`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id SET DATA TYPE SERIAL`;

            const after = cloneDeep(before);
            after.account.columns.id.dataType = `SERIAL`;

            simulate(before, query, after);
        });

        it(`should alter column set default 123`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id SET DEFAULT 123`;

            const after = cloneDeep(before);
            after.account.columns.id.constraints = {
                default: {
                    expression: `123`,
                },
            };

            simulate(before, query, after);
        });

        it(`should alter column set default 123`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                default: {
                                    expression: `123`,
                                }
                            },
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id DROP DEFAULT`;

            const after = cloneDeep(before);
            after.account.columns.id.constraints = {};

            simulate(before, query, after);
        });

        it(`should alter column set not null`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id SET NOT NULL`;

            const after = cloneDeep(before);
            after.account.columns.id.constraints = {
                notNull: {},
            };

            simulate(before, query, after);
        });

        it(`should alter column drop not null`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {
                                notNull: {},
                            },
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id DROP NOT NULL`;

            const after = cloneDeep(before);
            after.account.columns.id.constraints = {};

            simulate(before, query, after);
        });

        it(`should rename column`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account RENAME COLUMN id TO test`;

            const after = cloneDeep(before);
            after.account.columns.id.name = `test`;
            after.account.columns.test = after.account.columns.id;
            delete after.account.columns.id;

            simulate(before, query, after);
        });

        it(`should set default and not null`, () => {
            const before = {
                account: {
                    name: `account`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };

            const query = `ALTER TABLE account ALTER COLUMN id SET NOT NULL, ALTER COLUMN id SET DEFAULT 123`;

            const after = cloneDeep(before);
            after.account.columns.id.constraints = {
                notNull: {},
                default: {
                    expression: `123`,
                },
            };

            simulate(before, query, after);
        });

        it(`should alter table add column`, () => {
            const before = {
                test: {
                    name: `test`,
                    columns: {
                        id: {
                            dataType: `INTEGER`,
                            name: `id`,
                            constraints: {},
                        },
                    },
                },
            };
            const query = `ALTER TABLE test ADD COLUMN value TEXT`;
            const after = cloneDeep(before);
            after.test.columns.value = {
                dataType: `TEXT`,
                name: `value`,
                constraints: {},
            };

            simulate(before, query, after);
        });
    });
});
