/* eslint-disable import/no-dynamic-require */
import path from 'path';
import { createServer } from 'fire';

export default function start(entry) {
    require(path.join(process.cwd(), `.build`, `server.js`));

    createServer(entry);
}
