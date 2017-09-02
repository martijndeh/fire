import chalk from 'chalk';

const LOG_LEVEL_SILENT = 0;
const LOG_LEVEL_ERROR = 1;
const LOG_LEVEL_WARN = 2;
const LOG_LEVEL_SUCCESS = 3;
const LOG_LEVEL_INFO = 4;
const LOG_LEVEL_VERBOSE = 5;
const LOG_LEVEL_SILLY = 6;

function getLogLevelName(logLevel) {
    switch (logLevel) {
    case LOG_LEVEL_ERROR: return `ERR`;
    case LOG_LEVEL_WARN: return `WARN`;
    case LOG_LEVEL_SUCCESS: return `success`;
    case LOG_LEVEL_INFO: return `info`;
    case LOG_LEVEL_VERBOSE: return ``;
    case LOG_LEVEL_SILLY: return ``;
    }

    return `UNKNOWN`;
}

function getLogLevelColors(logLevel) {
    switch (logLevel) {
        case LOG_LEVEL_ERROR: return [
            `#FFFFFF`,
            `#B02C2C`,
        ];
        case LOG_LEVEL_WARN: return [
            `#000000`,
            `#FFB302`,
        ];
        case LOG_LEVEL_SUCCESS: return [
            `#4ADD20`,
            null,
        ];
        case LOG_LEVEL_INFO: return [
            `#FFEC02`,
            null,
        ];
        case LOG_LEVEL_VERBOSE: return [
            `#222222`,
            `#FFFFFF`,
        ];
        case LOG_LEVEL_SILLY: return [
            `#FFFFFF`,
            `#FF00FF`,
        ];
    }

    return `UNKNOWN`;
}

function getLogLevelString(logLevel) {
    const logLevelName = getLogLevelName(logLevel);
    const [
        color,
        bgColor,
    ] = getLogLevelColors(logLevel);

    return bgColor
        ? chalk.bgHex(bgColor)(chalk.hex(color)(logLevelName))
        : chalk.bold(chalk.hex(color)(logLevelName));
}

function length(string, maxLength, rightAlign) {
    let extra = ``;

    if (string.length < maxLength) {
        for (let i = 0; i < maxLength - string.length; i++) {
            extra += ` `;
        }
    }

    return rightAlign
        ? extra + string.substring(0, maxLength)
        : string.substring(0, maxLength) + extra;
}

function getLogLevel(logLevelString) {
    switch (logLevelString) {
    case `error`: return LOG_LEVEL_ERROR;
    case `warn`: return LOG_LEVEL_WARN;
    case `success`: return LOG_LEVEL_SUCCESS;
    case `info`: return LOG_LEVEL_INFO;
    case `verbose`: return LOG_LEVEL_VERBOSE;
    case `silly`: return LOG_LEVEL_SILLY;
    }

    return LOG_LEVEL_INFO;
}

function getProcessName() {
    return process.env.FOREMAN_WORKER_NAME || `web.1`;
}

function getProcessColor() {
    // TODO: Get a random color based on the process name.
    return `#FF00FF`;
}

export default class Log {
    level = LOG_LEVEL_SILENT;
    scope = new Set();
    colors = new Map();
    inScope = false;

    constructor(topic, levelString, debug) {
        const {
            LOG_LEVEL = `info`,
            DEBUG = `*`,
        } = process.env;

        this.topic = topic;
        this.level = getLogLevel(levelString || LOG_LEVEL);

        const scopes = new Set((debug || DEBUG).split(`,`));

        this.inScope = scopes.has(topic) || scopes.has(`*`) || scopes.has(`${topic.split(`:`, 1)[0]}:*`);
    }

    log(level, messages) {
        if (this.inScope && level <= this.level) {
            const isClient = typeof window !== `undefined`;

            messages.forEach((message) => {
                if (isClient) {
                    console.log(message); // eslint-disable-line no-console
                }
                else {
                    const logLevelString = getLogLevelString(level);
                    const date = new Date();
                    const processName = getProcessName();

                    let line = [
                        chalk.bold(chalk.hex(getProcessColor(processName))(length(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${processName}`, 17))),
                        chalk.bold(chalk.hex(`#AAAAAA`)(length(this.topic, 12, true))),
                        chalk.bold(chalk.hex(`#484C54`)(`|`)),
                    ];

                    if (logLevelString) {
                        line.push(logLevelString);
                    }

                    line.push(message);

                    console.log(line.join(` `)); // eslint-disable-line no-console
                }
            });
        }
    }

    error(...messages) {
        this.log(LOG_LEVEL_ERROR, messages);
    }

    warn(...messages) {
        this.log(LOG_LEVEL_WARN, messages);
    }

    success(...messages) {
        this.log(LOG_LEVEL_SUCCESS, messages);
    }

    info(...messages) {
        this.log(LOG_LEVEL_INFO, messages);
    }

    verbose(...messages) {
        this.log(LOG_LEVEL_VERBOSE, messages);
    }

    silly(...messages) {
        this.log(LOG_LEVEL_SILLY, messages);
    }
}
