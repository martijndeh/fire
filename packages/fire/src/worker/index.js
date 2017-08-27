import Queue from './queue.js';

const workers = [];

export function getWorkers() {
    return workers;
}

function getPropertyNames(Worker) {
    const prototype = Worker.OriginalClass
        ? Worker.OriginalClass.prototype
        : Worker.prototype;
    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}

export function startWorkers() {
    workers.forEach((Worker) => {
        new Worker();
    });
}

export function worker(queueUrl) {
    return (Worker) => {
        class WorkerWrapper {
            queue = null;

            constructor() {
                this.queue = new Queue(queueUrl);
                const propertyNames = getPropertyNames(Worker);

                propertyNames.forEach((propertyName) => {
                    this[propertyName] = function (...args) {
                        return this.queue.sendMessage(propertyName, args);
                    };
                });
            }
        }

        class WorkerStarter extends Worker {
            __queue = null;

            constructor() {
                super();

                this.__queue = new Queue(queueUrl);

                this.__receiveMessage();
            }

            async __receiveMessage() {
                const didConsumeMessages = await this.__queue.receiveMessage((name, args) => {
                    return this[name](...args);
                });
                const timeout = didConsumeMessages
                    ? 0
                    : 1000 * 10;

                setTimeout(() => {
                    this.__receiveMessage();
                }, timeout);
            }
        }

        workers.push(WorkerStarter);
        return WorkerWrapper;
    };
}
