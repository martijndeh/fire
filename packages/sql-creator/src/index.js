import { isEqual } from 'lodash';

function getTables(tables) {
    return Object.keys(tables).map((tableName) => tables[tableName]);
}

function getTypes(types) {
    return Object.keys(types).map((typeName) => types[typeName]);
}

function getColumns(table) {
    return Object.keys(table.columns).map((columnName) => table.columns[columnName]);
}

function getModifiersSql(column) {
    const modifiers = [];

    if (column.modifiers.default) {
        modifiers.push(`DEFAULT ${column.modifiers.default}`);
    }

    if (column.modifiers.notNull) {
        modifiers.push(`NOT NULL`);
    }

    return modifiers.join(` `);
}

function getColumnSql(table, column) {
    let query = `${column.name} ${column.dataType}`;

    if (Object.keys(column.modifiers).length > 0) {
        query += ` ${getModifiersSql(column)}`;
    }

    // Find applicable indexes.
    table.indexes.forEach((index) => {
        if (index.columns.length === 1 && index.columns[0] === column.name) {
            if (index.type === `primaryKey`) {
                query += ` PRIMARY KEY`;
            }
            else if (index.type === `foreignKey`) {
                query += ` REFERENCES ${index.tableName} (${index.referenceColumns.join(`, `)})`;
            }
            else if (index.type === `unique`) {
                query += ` UNIQUE`;
            }
            else if (index.type === `check`) {
                query += ` CHECK (${index.expression})`;
            }
        }
    });


    return query;
}

function isEqualColumn(fromColumn, toColumn) {
    if (!fromColumn || !toColumn || fromColumn.dataType !== toColumn.dataType) {
        return false;
    }

    const fromModifiers = fromColumn.modifiers;
    const toModifiers = toColumn.modifiers;
    return (
        (!fromModifiers.notNull && !toModifiers.notNull ||
            fromModifiers.notNull && toModifiers.notNull) &&
        (!fromModifiers.primaryKey && !toModifiers.primaryKey ||
            fromModifiers.primaryKey && toModifiers.primaryKey) &&
        (!fromModifiers.default && !toModifiers.default ||
            fromModifiers.default === toModifiers.default)
    );
}

function isEqualTable(fromTable, toTable) {
    return Object.keys(fromTable.columns).length === Object.keys(toTable.columns).length &&
        getColumns(fromTable).every((fromColumn) => isEqualColumn(fromColumn, toTable.columns[fromColumn.name]));
}

export default function createSql(from, to) {
    const queries = [];

    getTables(to.tables).forEach((toTable) => {
        const fromTable = from.tables[toTable.name];

        if (!fromTable) {
            const tables = getTables(from.tables).filter((fromTable) => isEqualTable(fromTable, toTable));
            if (tables.length === 1) {
                const table = tables[0];
                const query = `ALTER TABLE ${table.name} RENAME TO ${toTable.name}`;
                from.simulateQuery(query);
                queries.push(query);
            }
            else {
                const query = `CREATE TABLE ${toTable.name} (\n${Object.keys(toTable.columns).map((columnName) => toTable.columns[columnName]).map((column) => `\t${getColumnSql(toTable, column)}`).join(`,\n`)}\n)`;
                from.simulateQuery(query);
                queries.push(query);
            }
        }
        else {
            getColumns(toTable).forEach((toColumn) => {
                const fromColumn = fromTable.columns[toColumn.name];

                if (!fromColumn) {
                    const columns = getColumns(fromTable).filter((fromColumn) => isEqualColumn(fromColumn, toColumn));
                    const column = columns[0];

                    if (columns.length === 1 && !toTable.columns[column.name]) {
                        const query = `ALTER TABLE ${toTable.name} RENAME COLUMN ${column.name} TO ${toColumn.name}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else {
                        let query = `ALTER TABLE ${toTable.name} ADD COLUMN ${getColumnSql(toTable, toColumn)}`;

                        from.simulateQuery(query);
                        queries.push(query);
                    }
                }
                else {
                    // TODO: Create one alter table query if there are multiple changes.

                    if (fromColumn.dataType !== toColumn.dataType) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} SET DATA TYPE ${toColumn.dataType}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }

                    if (fromColumn.modifiers.notNull && !toColumn.modifiers.notNull) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} DROP NOT NULL`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (!fromColumn.modifiers.notNull && toColumn.modifiers.notNull) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} SET NOT NULL`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }

                    if (fromColumn.modifiers.default && !toColumn.modifiers.default) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} DROP DEFAULT`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (!fromColumn.modifiers.default && toColumn.modifiers.default) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} SET DEFAULT ${toColumn.modifiers.default}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                }
            });

            getColumns(fromTable).forEach((fromColumn) => {
                const toColumn = toTable.columns[fromColumn.name];

                if (!toColumn) {
                    // TODO: Check if this was a rename.

                    const query = `ALTER TABLE ${toTable.name} DROP COLUMN ${fromColumn.name}`;
                    from.simulateQuery(query);
                    queries.push(query);
                }
            });

            fromTable.indexes.forEach((fromIndex) => {
                const toIndex = toTable.indexes.find((toIndex) => isEqual(toIndex, fromIndex));

                if (!toIndex) {
                    const query = `ALTER TABLE ${toTable.name} DROP CONSTRAINT ${fromIndex.name}`;
                    from.simulateQuery(query);
                    queries.push(query);
                }
            });

            toTable.indexes.forEach((toIndex) => {
                const fromIndex = fromTable.indexes.find((fromIndex) => isEqual(fromIndex, toIndex));

                if (!fromIndex) {
                    if (toIndex.type === `primaryKey`) {
                        const query = `ALTER TABLE ${toTable.name} ADD CONSTRAINT ${toIndex.name} PRIMARY KEY (${toIndex.columns.join(`, `)})`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (toIndex.type === `unique`) {
                        const query = `ALTER TABLE ${toTable.name} ADD CONSTRAINT ${toIndex.name} UNIQUE (${toIndex.columns.join(`, `)})`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (toIndex.type === `foreignKey`) {
                        const query = `ALTER TABLE ${toTable.name} ADD CONSTRAINT ${toIndex.name} FOREIGN KEY (${toIndex.columns.join(`, `)}) REFERENCES ${toIndex.tableName}${toIndex.referenceColumns.length > 0 ? ` (${toIndex.referenceColumns.join(`, `)})` : ``}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (toIndex.type === `check`) {
                        const query = `ALTER TABLE ${toTable.name} ADD CONSTRAINT ${toIndex.name} CHECK (${toIndex.expression})`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else {
                        // Unknown index type.
                    }
                }
            });
        }
    });

    getTables(from.tables).forEach((fromTable) => {
        const toTable = to.tables[fromTable.name];

        if (!toTable) {
            const query = `DROP TABLE ${fromTable.name}`;
            from.simulateQuery(query);
            queries.push(query);
        }
    });

    getTypes(to.types).forEach((toType) => {
        const fromType = from.types[toType.name];

        if (!fromType) {
            const query = `CREATE TYPE ${toType.name} AS ENUM (${toType.labels.map((label) => `'${label}'`).join(`, `)})`;
            from.simulateQuery(query);
            queries.push(query);
        }
        else {
            const previousLabels = fromType.labels.reduce((labels, label, index) => {
                labels[label] = index;
                return labels;
            }, {});

            toType.labels.forEach((label, index) => {
                const exists = previousLabels[label] >= 0;

                if (!exists) {
                    if (index === 0) {
                        const query = `ALTER TYPE ${toType.name} ADD VALUE '${label}' BEFORE '${fromType.labels[0]}'`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else {
                        const query = `ALTER TYPE ${toType.name} ADD VALUE '${label}' AFTER '${fromType.labels[index - 1]}'`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                }
            });
        }
    });

    getTypes(from.types).forEach((fromType) => {
        const toType = to.types[fromType.name];

        if (!toType) {
            const query = `DROP TYPE ${fromType.name}`;
            from.simulateQuery(query);
            queries.push(query);
        }
    });

    return queries;
}
