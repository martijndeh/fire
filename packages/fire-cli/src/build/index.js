import { createServerBundle } from 'fire-webpack';
import rimraf from 'rimraf';
import { createMigrations } from 'sql-models';
import { transform } from 'babel-core';

/**
 * Builds the Node.js app.
 **/
export default async function build(entry: string) {
    rimraf.sync(`.build`);

    console.log(`Create server bundle`);

    await createServerBundle(entry);

    console.log(`Create migrations`);

    createMigrations();
}
