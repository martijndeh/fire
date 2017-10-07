
import Log from 'fire-log';
import { Schema } from 'sql-models';
import Queue from './queue.js';
import { addRegisterProvider, getPropertyNames } from '../injector/index.js';

const log = new Log(`fire:worker`);
const workers = [];

export function getWorkers() {
    return workers;
}

export function startWorkers() {
    log.info(`Starting ${workers.length} workers.`);

    Schema.autoLoadTables();

    const schema = new Schema();

    workers.forEach((Worker) => {
        const worker = new Worker(false, schema);
        worker.start();
    });
}

export default class Worker {
    queue = null;
    schema = null;

    constructor(replaceProperties = true, schema) {
        this.queue = new Queue(this.getQueueUrl());
        this.schema = schema;

        if (replaceProperties) {
            this.replaceProperties();
        }
    }

    replaceProperties() {
        log.info(`Replacing property names in worker.`);

        const propertyNames = getPropertyNames(this.constructor);

        propertyNames.forEach((propertyName) => {
            this[propertyName] = (...args) => {
                return this.queue.sendMessage(propertyName, args);
            };
        });
    }

    start() {
        log.info(`Start worker ${this.name}`);

        this.receiveMessage();
    }

    getQueueUrl() {
        throw new Error(`Worker#getQueueUrl() should be overridden to return a valid queue url.`);
    }

    async receiveMessage() {
        const didConsumeMessages = await this.queue.receiveMessage((name, args) => {
            return this[name](...args);
        });

        // TODO: This is very basic. Perhaps we want a nice backoff algorithm?
        const timeout = didConsumeMessages
            ? 0
            : 1000 * 10;

        setTimeout(() => {
            this.receiveMessage();
        }, timeout);
    }
}

addRegisterProvider((Class, worker) => {
    if (worker instanceof Worker) {
        workers.push(Class);
    }
});
