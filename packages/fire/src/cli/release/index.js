import { runMigrations } from 'sql-models';

export default async function release() {
    await runMigrations();
}
