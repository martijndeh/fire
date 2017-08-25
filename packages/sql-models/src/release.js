import Lego from 'lego-sql';

export async function getDatabaseVersion() {
    try {
        const row = await Lego.sql `SELECT version FROM lego.migrations ORDER BY created_at DESC LIMIT 1`.first();
        if (row) {
            return row.version;
        }

        return 0;
    }
    catch (error) {
        const relationDoesNotExistErrorCode = `42P01`;

        if (error.code === relationDoesNotExistErrorCode || error.sqlState === relationDoesNotExistErrorCode) {
            return 0;
        }
        else {
            throw error;
        }
    }
}

export async function createMigrationsTable() {
    try {
        await Lego.sql `CREATE SCHEMA lego CREATE TABLE migrations (
            version INTEGER,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`;
    }
    catch (error) {
        const schemaAlreadyExistsErrorCode = `42P06`;

        if (error.code == schemaAlreadyExistsErrorCode || error.sqlState === schemaAlreadyExistsErrorCode) {
            // The schema already exists. That's fine.
        }
        else {
            throw error;
        }
    }
}

export function insertMigration(version) {
    return Lego.sql `INSERT INTO lego.migrations (version) VALUES (${version})`;
}
