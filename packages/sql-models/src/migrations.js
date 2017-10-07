import fs from 'fs';
import path from 'path';

export function zeroPad(number, base) {
	const length = String(base).length - String(number).length + 1;
	return new Array(length).join(`0`) + number;
}

export function getMigrationFileNames() {
    return new Promise((resolve, reject) => {
        fs.readdir(path.join(process.cwd(), `migrations`), function (error, fileNames) {
            if (error) {
                if (error.errno === -2) {
                    // The directory does not exist.
                    resolve([]);
                }
                else {
                    reject(error);
                }
            }
            else {
                const migrationsPath = path.join(process.cwd(), `migrations`);

                resolve(fileNames.map((fileName) => {
                    return path.join(migrationsPath, fileName);
                }));
            }
        });
    });
}

export async function getCurrentVersion() {
    const migrationFileNames = await getMigrationFileNames();

    return migrationFileNames
        .map(function (fileName) {
            const baseName = path.basename(fileName);
            const matches = baseName.match(/^([0-9]+).*\.js$/);

            if (matches && matches.length > 1) {
                return parseInt(matches[1]);
            }
            else {
                return 0;
            }
        })
        .reduce(function (current, value) {
            if (value > current) {
                return value;
            }
            else {
                return current;
            }
        }, 0);
}

export function createMigrationContents(upQueries, downQueries) {
    // TODO: We should add tabs accordingly.

    const tab = `\t`;
    return `export function up(transaction) {
    ${upQueries.map((query) => `transaction.sql \`${query.split(`\n`).join(`\n${tab}`)}\`;`).join(`\n\n`)}
}

export function down(transaction) {
    ${downQueries.map((query) => `transaction.sql \`${query.split(`\n`).join(`\n${tab}`)}\`;`).join(`\n\n`)}
}
`;
}

export function createDirectory(directoryPath) {
    return new Promise(function (resolve, reject) {
		fs.mkdir(directoryPath, function (error) {
			if (error && error.code !== `EEXIST`) {
				reject(error);
			}
            else {
                resolve();
            }
        });
    });
}

export async function writeMigration(version, contents) {
	return new Promise(async function (resolve, reject) {
        const migrationsPath = path.join(process.cwd(), `migrations`);
        await createDirectory(migrationsPath);

        const versionString = zeroPad(version, 100);
        const fileName = versionString + `.js`;
        fs.writeFile(path.join(migrationsPath, fileName), contents, function (error) {
            if (error) {
                reject(error);
            }
            else {
                resolve(fileName);
            }
        });
	});
}
