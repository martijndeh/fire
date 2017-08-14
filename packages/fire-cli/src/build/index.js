import { createServerBundle } from 'fire-webpack';
import rimraf from 'rimraf';

/**
 * Builds the Node.js app.
 **/
export default async function build(entry: string) {
    rimraf.sync(`.build`);

    await createServerBundle(entry);
}
