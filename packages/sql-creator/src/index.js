function getTables(state) {
    return Object.keys(state).map((tableName) => state[tableName]);
}

function getColumns(table) {
    return Object.keys(table.columns).map((columnName) => table.columns[columnName]);
}

function getConstraintsSql(columnConstraints) {
    const constraints = [];

    if (columnConstraints.default) {
        constraints.push(`DEFAULT ${columnConstraints.default.expression}`);
    }

    if (columnConstraints.notNull) {
        constraints.push(`NOT NULL`);
    }

    if (columnConstraints.primaryKey) {
        constraints.push(`PRIMARY KEY`);
    }

    if (columnConstraints.check) {
        constraints.push(`CHECK (${columnConstraints.check.expression})`);
    }

    // TODO: references? Where is it?
    if (columnConstraints.references) {
        constraints.push(`REFERENCES ${columnConstraints.references.tableName}(${columnConstraints.references.columnName})`);
    }

    return constraints.join(` `);
}

function getColumnSql(column) {
    let query = `${column.name} ${column.dataType}`;

    if (Object.keys(column.constraints).length > 0) {
        query += ` ${getConstraintsSql(column.constraints)}`;
    }

    return query;
}

function isEqualColumn(fromColumn, toColumn, includeCheckConstraint) {
    if (!fromColumn || !toColumn || fromColumn.dataType !== toColumn.dataType) {
        return false;
    }

    const fromConstraints = fromColumn.constraints;
    const toConstraints = toColumn.constraints;
    return (
        (!fromConstraints.notNull && !toConstraints.notNull ||
            fromConstraints.notNull && toConstraints.notNull) &&
        (!fromConstraints.primaryKey && !toConstraints.primaryKey ||
            fromConstraints.primaryKey && toConstraints.primaryKey) &&
        (!fromConstraints.default && !toConstraints.default ||
            fromConstraints.default.expression === toConstraints.default.expression) &&
        (!fromConstraints.references && !toConstraints.references ||
            fromConstraints.references.tableName === toConstraints.references.tableName &&
            fromConstraints.references.columnName === toConstraints.references.columnName) &&
        (!fromConstraints.unique && !toConstraints.unique || fromConstraints.unique && toConstraints.unique) &&
        (!includeCheckConstraint || !fromConstraints.check && !toConstraints.check ||
            fromConstraints.check.expression === toConstraints.check.expression)
    );
}

function isEqualTable(fromTable, toTable) {
    return getColumns(fromTable).every((fromColumn) => isEqualColumn(fromColumn, toTable.columns[fromColumn.name], true));
}

export default function createSql(from, to) {
    console.log(`createSql`);
    console.log(JSON.stringify(from.tables));
    console.log(JSON.stringify(to.tables));

    const queries = [];

    getTables(to.tables).forEach((toTable) => {
        const fromTable = from.tables[toTable.name];

        if (!fromTable) {
            // TODO: Check if this was a rename.
            const tables = getTables(from.tables).filter((fromTable) => isEqualTable(fromTable, toTable));
            if (tables.length === 1) {
                const table = tables[0];
                const query = `ALTER TABLE ${table.name} RENAME TO ${toTable.name}`;
                from.simulateQuery(query);
                queries.push(query);
            }
            else {
                const query = `CREATE TABLE ${toTable.name} (\n${Object.keys(toTable.columns).map((columnName) => toTable.columns[columnName]).map((column) => `\t${getColumnSql(column)}`).join(`,\n`)}\n)`;
                from.simulateQuery(query);
                queries.push(query);
            }
        }
        else {
            getColumns(toTable).forEach((toColumn) => {
                const fromColumn = fromTable.columns[toColumn.name];

                if (!fromColumn) {
                    // The assumption is that if you include a CHECK constraint, and you rename the
                    // column, you also need to change the CHECK constraints. So over here we do not
                    // check if the CHECK constraint is the same.
                    const columns = getColumns(fromTable).filter((fromColumn) => isEqualColumn(fromColumn, toColumn, false));
                    if (columns.length === 1) {
                        const column = columns[0];

                        const query = `ALTER TABLE ${toTable.name} RENAME COLUMN ${column.name} TO ${toColumn.name}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else {
                        let query = `ALTER TABLE ${toTable.name} ADD COLUMN ${getColumnSql(toColumn)}`;

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

                    if (fromColumn.constraints.notNull && !toColumn.constraints.notNull) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} DROP NOT NULL`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (!fromColumn.constraints.notNull && toColumn.constraints.notNull) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} SET NOT NULL`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }

                    if (fromColumn.constraints.default && !toColumn.constraints.default) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} DROP DEFAULT`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }
                    else if (!fromColumn.constraints.default && toColumn.constraints.default) {
                        const query = `ALTER TABLE ${toTable.name} ALTER COLUMN ${toColumn.name} SET DEFAULT ${toColumn.constraints.default.expression}`;
                        from.simulateQuery(query);
                        queries.push(query);
                    }

                    // TODO: Set unique, primary key, check, references.
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
        }
    });

    getTables(from.tables).forEach((fromTable) => {
        const toTable = to.tables[fromTable.name];

        if (!toTable) {
            const query = `DROP TABLE ${fromTable.name}`;
            from.simulateQuery(query);
            queries.push(query);
        }
    })

    return queries;
}
