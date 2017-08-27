/* eslint-disable import/no-dynamic-require */
import path from 'path';
import { createServer, startWorkers } from 'fire';
import dotenv from 'dotenv';

export default function start(entry, argv) {
    dotenv.load({
        silent: true,
    });

    require(path.join(process.cwd(), `.build`, `lib`, `index.js`));

    if (argv.workers) {
        startWorkers();
    }
    else {
        createServer(entry);
    }
}
