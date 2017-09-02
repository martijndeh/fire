import minimist from 'minimist';
import path from 'path';
import build from './build/index.js';
import start from './start/index.js';
import release from './release/index.js';
import fly from './fly/index.js';

function main() {
    const argv = minimist(process.argv.slice(2));
    const [
        topic,
    ] = argv._;
    const entry = path.join(process.cwd(), `src`, `index.js`);

    try {
        process.env.FIRE_STAGE = topic;

        switch (topic) {
            case `build`:
                return build(entry, argv);

            case `start`:
                return start(argv.workers ? `workers` : `web`);

            case `release`:
                return release(entry, argv);

            case `fly`:
                return fly(entry, argv);

            default:
                return console.log(`Unknown topic ${fly}.`);
        }
    }
    catch (e) {
        console.log(`exceptionnn`);
        console.log(e);
        console.log(e.stack);
        throw e;
    }
}

main();
