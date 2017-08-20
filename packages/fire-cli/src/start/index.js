/* eslint-disable import/no-dynamic-require */
import path from 'path';
import { createServer } from 'fire';
import dotenv from 'dotenv';

export default function start(entry) {
    dotenv.load({
        silent: true,
    });

    require(path.join(process.cwd(), `.build`, `server.js`));

    createServer(entry);
}
