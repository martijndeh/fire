import chokidar from 'chokidar';
import path from 'path';
import { createMigrations } from 'sql-models';
import { createServerBundle, createLib } from 'fire-webpack';
import { spawn } from 'child_process';
import Log from 'fire-log';
import rimraf from 'rimraf';

const log = new Log(`fire-cli:fly`);

export default async function fly(entry, argv) {
    log.info(`fly()`);

    const baseDir = path.join(process.cwd(), `src`);
    const baseDirLength = baseDir.length + path.sep.length;
    const watcher = chokidar.watch(baseDir, {
        persistent: true,
    });

    let web     = null;
    let workers = null;

    async function startWeb() {
        log.info(`startWeb!`);

        if (web) {
            await new Promise((resolve) => {
                web.on(`close`, () => {
                    resolve();
                });
            });
        }

        web = spawn(`fire`, [`start`, `--web`], {
            stdio: `inherit`,
        });

        web.on(`error`, (error) => {
            log.error(error);
        });

        web.on(`close`, (code) => {
            if (code !== 0) {
                log.info(`grep process exited with code ${code}`);
            }

            web = null;
        });
    }

    function startWorkers() {
        //
    }

    watcher.on(`change`, async (changedPath) => {
        const filePath = changedPath.slice(baseDirLength);
        const [
            folder,
        ] = filePath.split(path.sep);

        const isClientChange = folder === `components` || folder === `containers` || folder === `stores`;
        if (isClientChange) {
            // Do we want to do anything?
        }
        else {
            const isModelChange = folder === `models`;
            const isWorkerChange = folder === `workers`;

            if (isModelChange) {
                await createMigrations();

                // TODO: We should ask if we should apply a release?
            }

            try {
                await Promise.all([
                    createServerBundle(entry),
                    createLib(entry),
                ]);

                startWeb();

                if (isWorkerChange) {
                    startWorkers();
                }
            }
            catch (e) {
                console.log(`exception in babel/build`);
                console.log(e);
            }
        }
    });

    rimraf.sync(`.build`);

    await Promise.all([
        createServerBundle(entry),
        createLib(entry),
    ]);
    await createMigrations();

    await startWeb();
}
