import assert from 'assert';
import fs from 'fs';
import path from 'path';
import Table from './table.js';

const AST_FILE_PATH = path.join(process.cwd(), `.build`, `ast.js`);
const DEFAULT_TABLES_PATH = path.join(process.cwd(), `.build`, `lib`, `tables`);

const tableClasses = [];

export default class Schema {
    // Load the ast, load all the tables.
    static loadTables(simulator) {
        const allTableNames = {};

        tableClasses.forEach((Table) => {
            const transaction = {
                sql(strings) {
                    simulator.simulateQuery(strings[0]);
                }
            };

            const tableNames = new Set(Object.keys(simulator.tables));

            Table.create(transaction);

            const newTableNames = Object.keys(simulator.tables).filter((tableName) => !tableNames.has(tableName));

            assert(newTableNames.length === 1, `Multiple tables found in ${Table.name}. Only one is allowed.`);

            const tableName = newTableNames[0];

            assert(!tableNames[Table.name], `Table ${Table.name} with database table ${tableName} already exists. Did you forget to rename the table model?`);

            const name = Table.name[0].toUpperCase() + Table.name.substring(1);
            allTableNames[name] = tableName;
        });

        return allTableNames;
    }

    static writeAstSync(simulator, tableNames) {
        const object = {
            ...simulator.toJSON(),
            tableNames,
        };

        fs.writeFileSync(AST_FILE_PATH, `module.exports = ${JSON.stringify(object)}`);
    }

    static autoLoadTables() {
        // For now, only load the tables if no table classes are set manually.
        const shouldAutoLoadTables = tableClasses.length === 0;

        if (shouldAutoLoadTables) {
            const filePaths = fs.readdirSync(DEFAULT_TABLES_PATH);

            filePaths.forEach((filePath) => {
                if (path.extname(filePath) === `.js`) {
                    /* eslint-disable import/no-dynamic-require */
                    const file = require(path.join(DEFAULT_TABLES_PATH, filePath));
                    /* eslint-enable import/no-dynamic-require */

                    // TODO: Check if this is a Table class.
                    assert(file.default, `You should export a default table in ${filePath}.`);

                    tableClasses.push(file.default);
                }
            });
        }
    }

    static addTableClasses(manualTableClasses) {
        tableClasses.push(...manualTableClasses);
    }

    /* eslint-disable import/no-dynamic-require */
    constructor(ast = require(AST_FILE_PATH)) {
        tableClasses.forEach((Table) => {
            const name = Table.name;
            const tableName = ast.tableNames[name];

            this[tableName] = new Table(ast, tableName);
        });
    }
    /* eslint-enable import/no-dynamic-require */

    transaction(callback) {
        // TODO: Fork this schema & make execute through a transaction.
    }
}
