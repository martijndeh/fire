/* eslint-disable import/no-dynamic-require */
import path from 'path';
import { createServer, startWorkers } from 'fire';
import dotenv from 'dotenv';

export default function start(type) {
    dotenv.load({
        silent: true,
    });

    require(path.join(process.cwd(), `.build`, `lib`, `index.js`));

    if (type === `workers`) {
        return startWorkers();
    }
    else if (type === `web`) {
        return createServer();
    }
    else {
        throw new Error(`Unknown start type ${type}.`);
    }
}
