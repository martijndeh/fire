import assert from 'assert';
import { escapeRegExp, cloneDeep } from 'lodash';

export default class Simulator {
    constructor(simulator) {
        this.tables = {};
        this.types = {};
        this.input = null;

        if (simulator) {
            this.tables = cloneDeep(simulator.tables);
            this.types = cloneDeep(simulator.types);
        }
    }

    toJSON() {
        return {
            tables: this.tables,
            types: this.types,
        };
    }

    findByRegExp(regexp) {
        const result = regexp.exec(this.input);

        if (result) {
            const found = result[1];
            this.input = this.input.slice(found.length).replace(/^\s*/g, ``);
            return found;
        }

        return null;
    }

    getToken(expectedTokens) {
        const result = this.findToken(expectedTokens);

        if (!result) {
            throw new Error(`Could not find one of token ${expectedTokens.join(`, `)}.`);
        }

        return result;
    }

    findToken(expectedTokens) {
        const regexp = new RegExp(`^(${expectedTokens.map((token) => escapeRegExp(token)).join(`|`)})(\\b|\\s|$|,|')`, `i`);
        return this.findByRegExp(regexp);
    }

    optionalToken(expectedTokens) {
        const token = this.findToken(expectedTokens);

        return Boolean(token);
    }

    ifToken(expectedTokens, ifCallback, elseCallback) {
        const token = this.findToken(expectedTokens);

        if (token) {
            ifCallback(token);

            return true;
        }
        else if (elseCallback) {
            elseCallback();
        }

        return false;
    }

    getUntil(excludeTokens) {
        const regexp = new RegExp(`^(.*?)\\s*(:?!${excludeTokens.map((token) => escapeRegExp(token)).join(`|`)}|$)`, `i`);
        const result =  this.findByRegExp(regexp);

        if (!result) {
            throw new Error(`Could not find one of ${excludeTokens}. Current input is ${this.input}`);
        }

        return result;
    }

    getIdentifier() {
        const regexp = new RegExp(`^([\\w\\._"]+)`, `i`);
        const result = this.findByRegExp(regexp);

        if (!result) {
            throw new Error(`Unknown identifier.`);
        }

        return result;
    }

    getString() {
        assert(this.input[0] === `'`, `Does not start with string opening '.`);

        for (let i = 1; i < this.input.length; i++) {
            const isEscaped = () => {
                let search = i - 1;
                let escaped = false;

                while (search >= 0) {
                    const character = this.input[search];

                    if (character === `\\`) {
                        escaped = !escaped;
                    }
                    else {
                        break;
                    }

                    search--;
                }

                return escaped;
            }

            const character = this.input[i];

            if (character === `'` && !isEscaped()) {
                const found = this.input.slice(1, i);
                this.input = this.input.slice(found.length + 2).replace(/^\s*/g, ``);
                return found;
            }
        }

        throw new Error(`Could not find end of string character '.`);
    }

    getInScope() {
        // We want to loop the input and keep track of strings etc.

        const state = {
            string: null,
            '{': 0,
            '(': 0,
            '[': 0,
        };

        const closingBraces = {
            '}': `{`,
            ')': `(`,
            ']': `[`,
        };
        const openingBraces = Object.keys(closingBraces).reduce((openingBraces, brace) => {
            openingBraces[closingBraces[brace]] = brace;
            return openingBraces;
        }, {});

        for (let i = 0; i < this.input.length; i++) {
            const isEscaped = () => {
                let search = i - 1;
                let escaped = false;

                while (search >= 0) {
                    const character = this.input[search];

                    if (character === `\\`) {
                        escaped = !escaped;
                    }
                    else {
                        break;
                    }

                    search--;
                }

                return escaped;
            }

            const character = this.input[i];

            if (state.string !== null) {
                if (character === state.string && !isEscaped()) {
                    state.string = null;
                }
            }
            else if (character === `)` && state[`{`] === 0 && state[`[`] === 0 && state[`(`] === 0 && !isEscaped()) {
                const found = this.input.slice(0, i);

                this.input = this.input.slice(found.length).replace(/^\s*/g, ``);
                return found;
            }

            else if (character === `"` || character === `'` || character === `\``) {
                state.string = character;
            }
            else if (closingBraces[character] && !isEscaped()) {
                state[closingBraces[character]] -= 1;

                if (state[closingBraces[character]] < 0) {
                    throw new Error(`A ${character} too many. There was no matching ${closingBraces[character]}.`);
                }
            }
            else if (openingBraces[character] && !isEscaped()) {
                state[character] += 1;
            }
        }

        throw new Error(`Could not find closing ).`);
    }

    getExpression() {
        const regexp = new RegExp(`^([\\w\\._"\\(\\)]+)`, `i`);
        const result = this.findByRegExp(regexp);

        if (!result) {
            throw new Error(`Unknown identifier.`);
        }

        return result;
    }

    scope(callback) {
        const openBracket = this.findToken([`(`]);

        if (openBracket) {
            const result = callback();

            this.getToken([`)`]);

            return result;
        }
    }

    repeat(callback) {
        while (true) {
            const result = callback();

            if (!result) {
                break;
            }
        }
    }

    switchToken(map) {
        const expectedTokens = Object.keys(map);
        return this.ifToken(expectedTokens, (token) => {
            const callback = map[token];

            callback();
        });
    }

    simulateDropType() {
        this.optionalToken([`IF EXISTS`]);

        const typeName = this.getIdentifier();

        this.ifToken([`CASCADE`, `RESTRICT`], () => {
            //
        });

        if (this.types[typeName]) {
            delete this.types[typeName];
        }
    }

    simulateDropTable() {
        this.optionalToken([`IF EXISTS`]);

        const tableName = this.getIdentifier();

        this.ifToken([`CASCADE`, `RESTRICT`], () => {
            //
        });

        if (this.tables[tableName]) {
            delete this.tables[tableName];
        }
    }

    simulateAlterType() {
        const typeName = this.getIdentifier();
        const type = this.types[typeName];

        this.getToken([`ADD`]);
        this.getToken([`VALUE`]);

        const newValue = this.getString();

        this.ifToken([`BEFORE`, `AFTER`], (token) => {
            const existingValue = this.getString();
            const index = type.labels.findIndex((label) => label === existingValue);

            if (token.toUpperCase() === `BEFORE`) {
                type.labels.splice(index, 0, newValue);
            }
            else {
                type.labels.splice(index + 1, 0, newValue);
            }
        });
    }

    simulateAlterTable() {
        this.ifToken([`ALL IN TABLESPACE`], () => {
            const tableName = this.getIdentifier();

            this.ifToken([`OWNED BY`], () => {
                // TODO: Is there a repeat here?
                const roleName = this.getIdentifier();
            });

            this.getToken([`SET TABLESPACE`]);

            const newTablespace = this.getIdentifier();

            this.ifToken([`NOWAIT`], () => {
                //
            });

            // FINISHED.
        });

        this.ifToken([`IF EXISTS`], () => {
            //
        });

        this.ifToken([`ONLY`], () => {

        });

        const tableName = this.getIdentifier();
        const table = this.tables[tableName];

        assert(table, `Table ${tableName} does not exist.`);

        const found = this.switchToken({
            RENAME: () => {
                this.ifToken(
                    [`CONSTRAINT`],
                    () => {
                        const constraintName = this.getIdentifier();

                        this.getToken([`TO`]);

                        const newConstraintName = this.getIdentifier();

                        // TODO: rename to constraint.
                    },
                    () => {
                        this.ifToken(
                            [`TO`],
                            () => {
                                const newTableName = this.getIdentifier();
                                table.name = newTableName;
                                this.tables[newTableName] = table;
                                delete this.tables[tableName];
                            },
                            () => {
                                this.optionalToken([`COLUMN`]);

                                const columnName = this.getIdentifier();

                                this.getToken([`TO`]);

                                const newColumnName = this.getIdentifier();

                                const table = this.tables[tableName];
                                const column = table.columns[columnName];
                                column.name = newColumnName;
                                table.columns[newColumnName] = column;
                                delete table.columns[columnName];
                            });
                    });
            },

            [`SET SCHEMA`]: () => {
                const newSchemaName = this.getIdentifier();

                // TODO: Set the schema name. This also means we need to parse the schema from the
                // table name?
            },
        });

        if (!found) {
            this.repeat(() => {
                this.switchToken({
                    'DROP CONSTRAINT': () => {
                        const constraintName = this.getIdentifier();
                        const i = table.indexes.findIndex((index) => index.type === `check` && index.name === constraintName);
                        table.indexes.splice(i, 1);
                    },

                    ADD: () => {
                        this.optionalToken([`COLUMN`]);

                        this.ifToken([`IF NOT EXISTS`], () => {
                            //
                        });

                        const {
                            column,
                            indexes,
                        } = this.getColumn(table);

                        if (column) {
                            table.columns[column.name] = column;
                        }

                        indexes.forEach((index) => this.addIndex(table, index));
                    },

                    DROP: () => {
                        this.optionalToken([`COLUMN`]);

                        this.ifToken([`IF NOT EXISTS`], () => {
                            //
                        });

                        const columnName = this.getIdentifier();

                        this.ifToken([`RESTRICT`, `CASCADE`], () => {

                        });

                        delete this.tables[tableName].columns[columnName];
                    },

                    ALTER: () => {
                        this.optionalToken([`COLUMN`]);

                        const columnName = this.getIdentifier();
                        const column = this.tables[tableName].columns[columnName];

                        this.switchToken({
                            'SET DATA TYPE': () => {
                                const dataType = this.getIdentifier();
                                column.dataType = dataType;
                            },

                            'TYPE': () => {
                                const dataType = this.getIdentifier();
                                column.dataType = dataType;
                            },

                            'SET DEFAULT': () => {
                                const expression = this.getExpression();
                                column.modifiers.default = expression;
                            },

                            'DROP DEFAULT': () => {
                                delete column.modifiers.default;
                            },

                            'SET NOT NULL': () => {
                                column.modifiers.notNull = true;
                            },

                            'DROP NOT NULL': () => {
                                delete column.modifiers.notNull;
                            },
                        });
                    },
                });

                return this.findToken([`,`]);
            });
        }
    }

    addIndex(table, index) {
        if (index.type === `primaryKey`) {
            table.indexes.splice(0, 0, index);
        }
        else {
            table.indexes.push(index);
        }
    }

    getColumn(table) {
        const indexes = [];
        let column = null;

        let constraintName = null;

        this.ifToken([`CONSTRAINT`], () => {
            constraintName = this.getIdentifier();
        });

        this.ifToken([`PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`], (token) => {
            const type = ((token) => {
                if (token === `primary key`) {
                    return `primaryKey`;
                }
                else if (token === `foreign key`) {
                    return `foreignKey`;
                }
                else if (token === `check`) {
                    return `check`;
                }

                return `unique`;
            })(token.toLowerCase());

            const index = {
                type,
                columns: [],
                name: null,
            };

            this.scope(() => {
                if (type === `check`) {
                    index.expression = this.getInScope();
                }
                else {
                    this.repeat(() => {
                        const columnName = this.getIdentifier();

                        index.columns.push(columnName);

                        return this.findToken([`,`]);
                    });
                }
            });

            if (type === `foreignKey`) {
                index.name = constraintName || `${table.name}_${index.columns.join(`_`)}_fkey`;

                this.getToken([`REFERENCES`]);

                const tableName = this.getIdentifier();
                const referenceColumns = [];

                this.scope(() => {
                    this.repeat(() => {
                        const columnName = this.getIdentifier();

                        referenceColumns.push(columnName);

                        return this.findToken([`,`]);
                    });
                });

                index.tableName = tableName;
                index.referenceColumns = referenceColumns;
            }
            else if (type === `primaryKey`) {
                index.name = constraintName || `${table.name}_${index.columns.join(`_`)}_pkey`;
            }
            else if (type === `unique`) {
                index.name = constraintName || `${table.name}_${index.columns.join(`_`)}_key`;
            }
            else if (type === `check`) {
                // FIXME: the CHECK is actually named based on the expression. If it references one
                // column it's added to the name. We can't just check if one of the columns is in
                // the expression, because it checks if it's really a reference.
                //
                // Some examples:
                //  "test_check" CHECK (1 > 0)
                //  "test_check1" CHECK (123 > 0)
                //  "test_check2" CHECK (foo_id > val)
                //  "test_val_check" CHECK (length('foo_id'::text) > val)
                //  "test_val_check1" CHECK (1 > val AND val < 0)

                if (constraintName) {
                    index.name = constraintName;
                }
                else {
                    const findIndexName = (indexName, count = 0) => {
                        const postfix = count === 0
                            ? ``
                            : String(count);
                        const name = indexName + postfix;

                        const exists = table.indexes.find((index) => index.name === name);

                        if (exists) {
                            return findIndexName(indexName, count + 1);
                        }

                        return name;
                    };

                    index.name = findIndexName(`${table.name}_check`);
                }
            }

            indexes.push(index);
        }, () => {
            column = {
                // TODO: The name may include the schema e.g. my.table (where "my" is the schema name)?
                name: this.getIdentifier(),
                dataType: this.getUntil([`COLLATE`, `CONSTRAINT`, `NULL`, `NOT NULL`, `CHECK`, `DEFAULT`, `UNIQUE`, `PRIMARY KEY`, `REFERENCES`, `,`, `)`]),
                modifiers: {},
            };

            this.ifToken([`COLLATE`], () => {
                column.collation = this.getIdentifier();
            });

            this.repeat(() => {
                let constraintName = null;

                // TODO: Can you name a constraint like this?
                this.ifToken([`CONSTRAINT`], () => {
                    constraintName = this.getIdentifier();
                });

                const found = this.switchToken({
                    [`NOT NULL`]: () => {
                        column.modifiers.notNull = true;
                    },

                    NULL: () => {
                        column.modifiers.null = true;
                    },

                    CHECK: () => {
                        const expression = this.scope(() => this.getInScope());
                        const index = {
                            type: `check`,
                            name: constraintName || `${table.name}_${column.name}_check`,
                            columns: [
                                column.name,
                            ],
                            expression,
                        };

                        this.ifToken([`NO INHERIT`], () => {
                            index.noInherit = true;
                        });

                        indexes.push(index);
                    },

                    DEFAULT: () => {
                        column.modifiers.default = this.getExpression();
                    },

                    UNIQUE: () => {
                        const index = {
                            type: `unique`,
                            name: `${table.name}_${column.name}_key`,
                            columns: [
                                column.name,
                            ],
                        };

                        this.ifToken([`WITH`], () => {
                            this.scope(() => {
                                index.parameters = [];

                                this.repeat(() => {
                                    const storageParameter = this.getIdentifier();

                                    if (!this.ifToken([`=`], () => {
                                        const storageValue = this.getIdentifier();

                                        index.parameters.push({
                                            key: storageParameter,
                                            value: storageValue,
                                        });
                                    })) {
                                        index.parameters.push({
                                            key: storageParameter,
                                            value: null,
                                        });
                                    }

                                    return this.findToken([`,`]);
                                });
                            });
                        });

                        this.ifToken([`USING INDEX TABLESPACE`], () => {
                            index.tablespaceName = this.getIdentifier();
                        });

                        indexes.push(index);
                    },

                    [`PRIMARY KEY`]: () => {
                        const index = {
                            type: `primaryKey`,
                            name: `${table.name}_pkey`,
                            columns: [
                                column.name,
                            ],
                        };

                        this.ifToken([`WITH`], () => {
                            this.scope(() => {
                                index.parameters = [];

                                this.repeat(() => {
                                    const storageParameter = this.getIdentifier();

                                    if (!this.ifToken([`=`], () => {
                                        const storageValue = this.getIdentifier();

                                        index.parameters.push({
                                            key: storageParameter,
                                            value: storageValue,
                                        });
                                    })) {
                                        index.parameters.push({
                                            key: storageParameter,
                                            value: null,
                                        });
                                    }

                                    return this.findToken([`,`]);
                                });
                            });
                        });

                        this.ifToken([`USING INDEX TABLESPACE`], () => {
                            index.tablespaceName = this.getIdentifier();
                        });

                        indexes.push(index);
                    },

                    REFERENCES: () => {
                        const index = {
                            type: `foreignKey`,
                            name: `${table.name}_${column.name}_fkey`,
                            tableName: this.getIdentifier(),
                            columns: [
                                column.name,
                            ],
                            referenceColumns: [],
                        };

                        this.scope(() => {
                            this.repeat(() => {
                                index.referenceColumns.push(this.getIdentifier());
                                return this.findToken([`,`]);
                            });
                        });

                        this.ifToken([`MATCH`], () => {
                            index.matchType = this.getToken([`FULL`, `PARTIAL`, `SIMPLE`]);
                        });

                        this.ifToken([`ON DELETE`], () => {
                            const actionType = this.getToken([`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`]);

                            index.onDelete = actionType;
                        });

                        this.ifToken([`ON UPDATE`], () => {
                            const actionType = this.getToken([`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`]);

                            index.onUpdate = actionType;
                        });

                        indexes.push(index);
                    },
                });

                if (found) {
                    // TODO: Where to apply this to?

                    this.ifToken([`DEFERRABLE`, `NOT DEFERRABLE`], (defferable) => {
                        // constraint.defferable = defferable;
                    });

                    this.ifToken([`INITIALLY DEFERRED`, `INITIALLY IMMEDIATE`], (initially) => {
                        // constraint.initially = initially;
                    });
                }

                return found;
            });
        });

        return {
            column,
            indexes,
        };
    }

    simulateCreateType() {
        const type = {
            type: `enum`,
            name: this.getIdentifier(),
            labels: [],
        };

        this.getToken([`AS`]);
        this.getToken([`ENUM`]);

        this.scope(() => {
            this.repeat(() => {
                const label = this.getString();
                type.labels.push(label);

                return this.findToken([`,`]);
            });
        });

        // FIXME: type names and table names may not collide. Because we store them separately, we
        // have no checks for this. Perhaps we should store the tables and types together in a
        // relations map instead?
        this.types[type.name] = type;
    }

    simulateCreateTable() {
        const table = {
            name: null,
            columns: {},
            indexes: [],
        };

        this.ifToken([`IF NOT EXISTS`], () => {
            table.ifNotExists = true;
        });

        table.name = this.getIdentifier();

        this.scope(() => {
            this.repeat(() => {
                const {
                    column,
                    indexes,
                } = this.getColumn(table);

                if (column) {
                    table.columns[column.name] = column;
                }

                indexes.forEach((index) => this.addIndex(table, index));

                return this.findToken([`,`]);
            });
        });

        // TODO: Parse WITH, ON COMMIT, TABLESPACE
        // TODO: Parse table constraints.

        this.tables[table.name] = table;
    }

    simulateQuery(sql) {
        this.input = sql.replace(/^\s+/, ``);

        const token = this.getToken([`CREATE`, `ALTER`, `DROP`, `SELECT`, `WITH`, `UPDATE`, `DELETE`]).toUpperCase();

        if (token === `SELECT` || token === `WITH` || token === `UPDATE` || token === `DELETE`) {
            // These queries do not alter the data structure, so we can ignore them.
            this.input = null;
        }
        else if (token === `CREATE`) {
            this.ifToken([`GLOBAL`, `LOCAL`, `TEMPORARY`, `TEMP`, `UNLOGGED`], () => {
                // TODO: It's GLOBAL or LOCAL, TEMPORARY or TEMP, or UNLOGGED. Pass this to the
                // table.
            });

            this.switchToken({
                TABLE: () => {
                    this.simulateCreateTable();
                },

                TYPE: () => {
                    this.simulateCreateType();
                },

                // TODO: TRIGGER, FUNCTION?
            });
        }
        else if (token === `ALTER`) {
            this.switchToken({
                TABLE: () => {
                    this.simulateAlterTable();
                },

                TYPE: () => {
                    this.simulateAlterType();
                },
            });
        }
        else if (token === `DROP`) {
            this.switchToken({
                TYPE: () => {
                    this.simulateDropType();
                },

                TABLE: () => {
                    this.simulateDropTable();
                },
            });
        }
    }
}
