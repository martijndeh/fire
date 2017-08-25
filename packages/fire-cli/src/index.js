import minimist from 'minimist';
import path from 'path';
import build from './build/index.js';
import start from './start/index.js';
import release from './release/index.js';

function main() {
    const argv = minimist(process.argv.slice(2));
    const [
    	topic,
    ] = argv._;

    const {
        npm_package_name: packageName,
        npm_package_version: packageVersion,
        npm_package_main: packageMain,
    } = process.env;

    if (!packageMain) {
        // TODO: If there is no main, try a couple of files e.g. first .js file in the dir.
        console.log(`"main" entry point not found in package.json.`);
        return;
    }

    const entry = path.join(process.cwd(), packageMain);

    try {
        process.env.FIRE_STAGE = topic;

        switch (topic) {
            case `build`:
                return build(entry);

            case `start`:
                return start(entry);

            case `release`:
                return release(entry);
        }
    }
    catch (e) {
        console.log(`e`);
        console.log(e);
        console.log(e.stack);
        throw e;
    }
}

main();
