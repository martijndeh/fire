import { createServerBundle } from 'fire-webpack';

/**
 * Builds the Node.js app.
 **/
export default function build(entry: string) {
    return createServerBundle(entry);
}
