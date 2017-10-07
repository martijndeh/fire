/* eslint-disable import/no-dynamic-require */
import path from 'path';
import { createServer, startWorkers } from '../..';

export default function start(type) {
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
