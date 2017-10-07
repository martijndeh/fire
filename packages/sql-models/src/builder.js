import assert from 'assert';
import Lego from 'lego-sql';

export default class Builder {
    constructor(table) {
        this.ast = table.ast;
        this.tableName = table.name;

        this.internal = Lego.sql([]);
    }

    then(callback, errback) {
		return this.internal.exec().then(callback, errback);
	}

	catch(errback) {
		return this.internal.exec().catch(errback);
	}

    control(sql) {
        if (this.registree.sql === sql) {
            this.registree = null;
        }
        else {
            this.registree.callback();
        }
    }

    _add(sql, strings, parameters) {
        if (this.registree) {
            this.control(sql);
        }

        this.internal.append([sql]);

        if (strings) {
            this.internal.append(strings, ...parameters);
        }

        return this;
    }

    sql(strings, ...parameters) {
        this.internal.append(strings, ...parameters);
        return this;
    }

    register(sql, callback) {
        this.registree = {
            sql,
            callback,
        };
    }

    select(strings, ...parameters) {
        this._add(`SELECT`, strings, parameters);
        this.register(`FROM`, () => {
            this.from `${Lego.raw(this.tableName)}`;
        });
        return this;
    }

    from(strings, ...parameters) {
        return this._add(`FROM`, strings, parameters);
    }

    insert(values) {
        this._add(`INSERT INTO ${this.tableName}`);

        const columnNames = values && Object.keys(values);

        if (columnNames && columnNames.length > 0) {
            this._add(`(${columnNames.join(`, `)}) VALUES (`);

            columnNames.forEach((columnName, index) => {
                if (index > 0) {
                    this.sql `, `;
                }

                this.sql `${values[columnName]}`;
            });

            this._add(`)`);
        }
        else {
            this._add(`DEFAULT VALUES`);
        }

        return this;
    }

    returning(strings, ...parameters) {
        return this._add(`RETURNING`, strings, parameters);
    }

    innerJoin(strings, ...parameters) {
        this._add(`INNER JOIN`, strings, parameters);
        this.register(`ON`, () => {
            const referenceTableName = strings[0];
            const referenceTable = this.ast.tables[referenceTableName];
            const table = this.ast.tables[this.tableName];

            assert(referenceTable, `Could not find reference table "${referenceTableName}" in schema-aware ON.`);
            assert(table, `Could not find table ${this.tableName} in schema-aware ON.`);

            const primaryKey = table.indexes[0];
            const foreignKey = referenceTable.indexes.find((foreignKey) => foreignKey.type === `foreignKey` && foreignKey.tableName === table.name);

            assert(primaryKey.type === `primaryKey`);

            // TODO: What if there are multiple columns? We're not covering that case yet.

            this.on `(${Lego.raw(table.name)}.${Lego.raw(primaryKey.columns[0])} = ${Lego.raw(referenceTable.name)}.${Lego.raw(foreignKey.columns[0])})`;
        });
        return this;
    }

    on(strings, ...parameters) {
        return this._add(`ON`, strings, parameters);
    }

    where(strings, ...parameters) {
        return this._add(`WHERE`, strings, parameters);
    }

    limit(strings, ...parameters) {
        return this._add(`LIMIT`, strings, parameters);
    }

    with(strings, ...parameters) {
        return this._add(`WITH`, strings, parameters);
    }

    withRecursive(strings, ...parameters) {
        return this._add(`WITH RECURSIVE`, strings, parameters);
    }

    leftJoin(strings, ...parameters) {
        return this._add(`LEFT JOIN`, strings, parameters);
    }

    leftOuterJoin(strings, ...parameters) {
        return this._add(`LEFT OUTER JOIN`, strings, parameters);
    }

    rightJoin(strings, ...parameters) {
        return this._add(`RIGHT JOIN`, strings, parameters);
    }

    rightOuterJoin(strings, ...parameters) {
        return this._add(`RIGHT OUTER JOIN`, strings, parameters);
    }

    outerJoin(strings, ...parameters) {
        return this._add(`OUTER JOIN`, strings, parameters);
    }

    fullOuterJoin(strings, ...parameters) {
        return this._add(`FULL OUTER JOIN`, strings, parameters);
    }

    crossJoin(strings, ...parameters) {
        return this._add(`CROSS JOIN`, strings, parameters);
    }

    offset(strings, ...parameters) {
        return this._add(`OFFSET`, strings, parameters);
    }

    groupBy(strings, ...parameters) {
        return this._add(`GROUP BY`, strings, parameters);
    }

    orderBy(strings, ...parameters) {
        return this._add(`ORDER BY`, strings, parameters);
    }

    having(strings, ...parameters) {
        return this._add(`HAVING`, strings, parameters);
    }

    update(strings, ...parameters) {
        return this._add(`UPDATE`, strings, parameters);
    }

    delete(strings, ...parameters) {
        return this._add(`DELETE`, strings, parameters);
    }

    toQuery() {
        if (this.registree) {
            this.control();
        }

        const {
            text,
            parameters,
        } = this.internal.toQuery();

        return {
            text,
            parameters,
        };
    }
}
