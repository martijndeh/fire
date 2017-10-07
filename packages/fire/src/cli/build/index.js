import { createServerBundle, createLib } from 'fire-webpack';
import rimraf from 'rimraf';
import { createMigrations } from 'sql-models';

/**
 * Builds the Node.js app.
 **/
export default async function build(entry: string) {
    rimraf.sync(`.build`);

    await createServerBundle(entry);

    await createLib(entry);

    await createMigrations();
}
