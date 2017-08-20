import { runMigrations } from 'sql-models';
import dotenv from 'dotenv';

export default async function release() {
    dotenv.load({
        silent: true,
    });

    await runMigrations();
}
