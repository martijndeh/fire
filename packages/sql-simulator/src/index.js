import { escapeRegExp } from 'lodash';

export default class Simulator {
    constructor() {
        this.tables = {};
        this.input = null;
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
        const regexp = new RegExp(`^(${expectedTokens.map((token) => escapeRegExp(token)).join(`|`)})(\\b|\\s|$)`, `i`);
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
        const regexp = new RegExp(`^(.*?)\\s*(:?!${excludeTokens.map((token) => escapeRegExp(token)).join(`|`)})`, `i`);
        const result =  this.findByRegExp(regexp);

        if (!result) {
            throw new Error(`Could not find getUntil.`);
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
            callback();

            this.getToken([`)`]);
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

    simulateDropTable() {
        this.getToken([`TABLE`]);

        this.optionalToken([`IF EXISTS`]);

        const tableName = this.getIdentifier();

        this.ifToken([`CASCADE`, `RESTRICT`], () => {
            //
        });

        if (this.tables[tableName]) {
            delete this.tables[tableName];
        }
    }

    simulateAlterTable() {
        this.getToken([`TABLE`]);

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

        const found = this.switchToken({
            RENAME: () => {
                this.ifToken(
                    [`CONSTRAINT`],
                    () => {
                        const constraintName = this.getIdentifier();

                        this.getToken([`TO`]);

                        const newConstraintName = this.getIdentifier();

                        // TODO: Actually name the constraint with name. Are these constraints on columns, or
                        // on tables?
                    },
                    () => {
                        this.ifToken(
                            [`TO`],
                            () => {
                                const newTableName = this.getIdentifier();

                                const table = this.tables[tableName];
                                table.name = newTableName;
                                this.tables[newTableName] = table;
                                delete this.tables[tableName];
                            },
                            () => {
                                this.optionalToken([`COLUMN`]);

                                const columnName = this.getIdentifier();

                                this.getToken([`TO`]);

                                const newColumnname = this.getIdentifier();

                                const table = this.tables[tableName];
                                const column = table.columns.find((column) => column.name === columnName);
                                column.name = newColumnname;
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
                    ADD: () => {
                        this.optionalToken([`COLUMN`]);

                        this.ifToken([`IF NOT EXISTS`], () => {
                            //
                        });

                        this.ifToken([`CONSTRAINT`], () => {
                            const constraintName = this.getIdentifier();
                        });

                        this.ifToken(
                            [`UNIQUE`, `PRIMARY KEY`],
                            (token) => {
                                this.scope(() => {
                                    const columnName = this.getIdentifier();

                                    const column = this.tables[tableName].columns.find((column) => column.name === columnName);
                                    if (token.toLowerCase() === `unique`) {
                                        column.constraints.unique = {};
                                    }
                                    else {
                                        column.constraints.primaryKey = {};
                                    }

                                    // TODO: It should be possible here to set multiple columns.
                                });
                            },
                            () => {
                                const column = this.getColumn();

                                this.tables[tableName].columns.push(column);
                            });
                    },

                    DROP: () => {
                        this.optionalToken([`COLUMN`]);

                        this.ifToken([`IF NOT EXISTS`], () => {
                            //
                        });

                        const columnName = this.getIdentifier();

                        this.ifToken([`RESTRICT`, `CASCADE`], () => {

                        });

                        const columns = this.tables[tableName].columns;

                        this.tables[tableName].columns = columns.filter((column) => column.name !== columnName);
                    },

                    ALTER: () => {
                        this.optionalToken([`COLUMN`]);

                        const columnName = this.getIdentifier();
                        const column = this.tables[tableName].columns.find((column) => column.name);

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
                                column.constraints.default = {
                                    expression,
                                };
                            },

                            'DROP DEFAULT': () => {
                                delete column.constraints.default;
                            },

                            'SET NOT NULL': () => {
                                column.constraints.notNull = {};
                            },

                            'DROP NOT NULL': () => {
                                delete column.constraints.notNull;
                            },
                        });
                    },
                });

                return this.findToken([`,`]);
            });
        }
    }

    getColumn() {
        const column = {
            // TODO: The name may include the schema.
            name: this.getIdentifier(),

            // TODO: Will this work without any constraint types?
            dataType: this.getUntil([`COLLATE`, `CONSTRAINT`, `NULL`, `NOT NULL`, `CHECK`, `DEFAULT`, `UNIQUE`, `PRIMARY KEY`, `REFERENCES`, `,`, `)`]),
            constraints: {},
        };

        this.ifToken([`COLLATE`], () => {
            column.collation = this.getIdentifier();
        });

        this.repeat(() => {
            const constraint = {};

            this.ifToken([`CONSTRAINT`], () => {
                constraint.name = this.getIdentifier();
            });

            const found = this.switchToken({
                [`NOT NULL`]: () => {
                    column.constraints.notNull = constraint;
                },

                NULL: () => {
                    column.constraints.null = constraint;
                },

                CHECK: () => {
                    this.scope(() => {
                        constraint.expression = this.getInScope();
                    });

                    this.ifToken([`NO INHERIT`], () => {
                        constraint.noInherit = true;
                    });

                    column.constraints.check = constraint;
                },

                DEFAULT: () => {
                    constraint.expression = this.getExpression();

                    column.constraints.default = constraint;
                },

                UNIQUE: () => {
                    this.ifToken([`WITH`], () => {
                        this.scope(() => {
                            constraint.parameters = [];

                            this.repeat(() => {
                                const storageParameter = this.getIdentifier();

                                if (!this.ifToken([`=`], () => {
                                    const storageValue = this.getIdentifier();

                                    constraint.parameters.push({
                                        key: storageParameter,
                                        value: storageValue,
                                    });
                                })) {
                                    constraint.parameters.push({
                                        key: storageParameter,
                                        value: null,
                                    });
                                }

                                return this.findToken([`,`]);
                            });
                        });
                    });

                    this.ifToken([`USING INDEX TABLESPACE`], () => {
                        constraint.tablespaceName = this.getIdentifier();
                    });

                    column.constraints.unique = constraint;
                },

                [`PRIMARY KEY`]: () => {
                    this.ifToken([`WITH`], () => {
                        this.scope(() => {
                            constraint.parameters = [];

                            this.repeat(() => {
                                const storageParameter = this.getIdentifier();

                                if (!this.ifToken([`=`], () => {
                                    const storageValue = this.getIdentifier();

                                    constraint.parameters.push({
                                        key: storageParameter,
                                        value: storageValue,
                                    });
                                })) {
                                    constraint.parameters.push({
                                        key: storageParameter,
                                        value: null,
                                    });
                                }

                                return this.findToken([`,`]);
                            });
                        });
                    });

                    this.ifToken([`USING INDEX TABLESPACE`], () => {
                        constraint.tablespaceName = this.getIdentifier();
                    });

                    column.constraints.primaryKey = constraint;
                },

                REFERENCES: () => {
                    constraint.referenceTableName = this.getIdentifier();

                    this.scope(() => {
                        constraint.referenceColumnName = this.getIdentifier();
                    });

                    this.ifToken([`MATCH`], () => {
                        constraint.matchType = this.getToken([`FULL`, `PARTIAL`, `SIMPLE`]);
                    });

                    this.ifToken([`ON DELETE`], () => {
                        const actionType = this.getToken([`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`]);

                        constraint.onDelete = actionType;
                    });

                    this.ifToken([`ON UPDATE`], () => {
                        const actionType = this.getToken([`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`]);

                        constraint.onUpdate = actionType;
                    });

                    column.constraints.references = constraint;
                },
            });

            if (found) {
                this.ifToken([`DEFERRABLE`, `NOT DEFERRABLE`], (defferable) => {
                    constraint.defferable = defferable;
                });

                this.ifToken([`INITIALLY DEFERRED`, `INITIALLY IMMEDIATE`], (initially) => {
                    constraint.initially = initially;
                });
            }

            return found;
        });

        return column;
    }

    simulateCreateTable() {
        const table = {
            name: null,
            columns: [],
        };

        // TODO: It's Global or local, temporary or temp, or unlogged.
        this.ifToken([`GLOBAL`, `LOCAL`, `TEMPORARY`, `TEMP`, `UNLOGGED`], (type) => {
            table.type = type;
        });

        this.getToken([`TABLE`]);

        this.ifToken([`IF NOT EXISTS`], () => {
            table.ifNotExists = true;
        });

        table.name = this.getIdentifier();

        this.scope(() => {
            this.repeat(() => {
                const column = this.getColumn();

                table.columns.push(column);

                return this.findToken([`,`]);
            });
        });

        // TODO: Parse WITH, ON COMMIT, TABLESPACE
        // TODO: Parse table constraints.

        this.tables[table.name] = table;
    }

    simulateQuery(sql) {
        this.input = sql.replace(/^\s+/, ``);

        const token = this.getToken([`CREATE`, `ALTER`, `DROP`]);

        if (token === `CREATE`) {
            this.simulateCreateTable();
        }
        else if (token === `ALTER`) {
            this.simulateAlterTable();
        }
        else if (token === `DROP`) {
            this.simulateDropTable();
        }
    }
}
